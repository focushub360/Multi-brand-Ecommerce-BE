
import { Category } from './category.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { AdminService } from '../admin/service/admin.service.js';
import { Product } from '../products/product.model.js';
import { Dealer } from '../dealers/dealer.model.js';

const auditCategoryAction = (actor, action, category, details) =>
  AdminService.recordAuditLog({
    action,
    actor: actor.id,
    actorRole: actor.role,
    targetEntity: 'Category',
    targetId: category._id.toString(),
    details,
    ipAddress: actor.ipAddress || '',
    userAgent: actor.userAgent || ''
  });

export class CategoryService {

  static async getAllCategories(includeInactive = false) {
    const filter = includeInactive ? {} : { status: 'Active' };

    return await Category.find(filter)
      .sort({ name: 1 })
      .lean();
  }

  static async getCategoryBySlug(slug) {
    const category = await Category.findOne({ slug }).lean();

    if (!category) {
      throw ApiError.notFound(
        `Category with slug '${slug}' not found.`
      );
    }

    return category;
  }

  // CREATE CATEGORY
  static async createCategory(data, actor) {
    const slug =
      data.slug ||
      data.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const existing = await Category.findOne({
      $or: [
        { name: data.name },
        { slug }
      ]
    });

    if (existing) {
      throw ApiError.conflict(
        `Category '${data.name}' or slug '${slug}' already exists.`
      );
    }

    // Format subcategories if provided
    const formattedSubcategories = (data.subcategories || []).map((sub) => {
      if (typeof sub === 'string') {
        const subName = sub.trim();
        const subSlug = subName.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        return {
          name: subName,
          slug: subSlug,
          description: '',
          status: 'Active'
        };
      }
      return {
        name: sub.name?.trim(),
        slug: sub.slug || sub.name?.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: sub.description || '',
        status: sub.status || 'Active'
      };
    }).filter((s) => Boolean(s.name));

    const imagesList = Array.isArray(data.images) && data.images.length > 0
      ? data.images
      : (data.image ? [data.image] : []);

    const category = new Category({
      name: data.name.trim(),
      slug,
      image: data.image || (imagesList[0] || ''),
      images: imagesList,
      description: data.description || '',
      icon: data.icon || 'Package',
      commissionRate: data.commissionRate !== undefined ? Number(data.commissionRate) : 5.0,
      status: data.status || 'Active',
      subcategories: formattedSubcategories
    });

    await category.save();

    await auditCategoryAction(
      actor,
      'CATEGORY_CREATED',
      category,
      `Created category ${category.name}.`
    );

    return category;
  }

  // UPDATE CATEGORY
  static async updateCategory(id, data, actor) {
    const category = await Category.findById(id);

    if (!category) {
      throw ApiError.notFound('Category not found.');
    }

    if (data.name && data.name.trim().toLowerCase() !== category.name.toLowerCase()) {
      const duplicate = await Category.findOne({
        name: data.name.trim(),
        _id: { $ne: category._id }
      });

      if (duplicate) {
        throw ApiError.conflict(
          'A category with that name already exists.'
        );
      }

      category.name = data.name.trim();
    }

    if (data.slug && data.slug !== category.slug) {
      const duplicateSlug = await Category.findOne({
        slug: data.slug,
        _id: { $ne: category._id }
      });

      if (duplicateSlug) {
        throw ApiError.conflict(
          'That category slug is already in use.'
        );
      }

      category.slug = data.slug;
    }

    if (data.image !== undefined) {
      category.image = data.image;
    }

    if (data.images !== undefined && Array.isArray(data.images)) {
      category.images = data.images;
    }

    if (data.description !== undefined) {
      category.description = data.description;
    }

    if (data.icon) category.icon = data.icon;

    if (data.commissionRate !== undefined) {
      category.commissionRate = Number(data.commissionRate);
    }

    if (data.status) category.status = data.status;

    if (data.subcategories && Array.isArray(data.subcategories)) {
      category.subcategories = data.subcategories.map((sub) => {
        if (typeof sub === 'string') {
          const subName = sub.trim();
          const subSlug = subName.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          return { name: subName, slug: subSlug, description: '', status: 'Active' };
        }
        return {
          name: sub.name?.trim(),
          slug: sub.slug || sub.name?.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description: sub.description || '',
          status: sub.status || 'Active'
        };
      }).filter((s) => Boolean(s.name));
    }

    await category.save();

    await auditCategoryAction(
      actor,
      'CATEGORY_UPDATED',
      category,
      `Updated category ${category.name}.`
    );

    return category;
  }

  // DELETE CATEGORY
  static async deleteCategory(id, actor) {
    const category = await Category.findById(id);

    if (!category) {
      throw ApiError.notFound('Category not found.');
    }

    const [productCount, dealerCount] = await Promise.all([
      Product.countDocuments({ category: category._id }),
      Dealer.countDocuments({ primaryCategory: category._id })
    ]);

    if (productCount || dealerCount) {
      throw ApiError.conflict(
        'This category is assigned to products or dealers. Deactivate it instead of deleting it.'
      );
    }

    await Category.findByIdAndDelete(id);

    await auditCategoryAction(
      actor,
      'CATEGORY_DELETED',
      category,
      `Deleted category ${category.name}.`
    );

    return {
      message: `Category '${category.name}' removed successfully.`
    };
  }

  // ADD SUBCATEGORY
  static async addSubcategory(categoryId, data, actor) {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw ApiError.notFound('Category not found.');
    }

    const slug =
      data.slug ||
      data.name.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-');

    const exists = category.subcategories.some(
      (s) =>
        s.slug === slug ||
        s.name.toLowerCase() === data.name.toLowerCase()
    );

    if (exists) {
      throw ApiError.conflict(
        `Subcategory '${data.name}' already exists in ${category.name}.`
      );
    }

    category.subcategories.push({
      name: data.name.trim(),
      slug,
      description: data.description || '',
      status: 'Active'
    });

    await category.save();

    await auditCategoryAction(
      actor,
      'SUBCATEGORY_CREATED',
      category,
      `Added subcategory ${data.name} to ${category.name}.`
    );

    return category;
  }
}
