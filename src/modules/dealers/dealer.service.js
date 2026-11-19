import { Dealer } from './dealer.model.js';
import { User } from '../users/user.model.js';
import { Category } from '../categories/category.model.js';
import { DEALER_STATUS } from '../../constants/dealerStatus.js';
import { ROLES } from '../../constants/roles.js';
import { ApiError } from '../../utils/ApiError.js';
import { generateSecurePassword } from '../../utils/generatePassword.js';
import { hashPassword } from '../../utils/passwordHash.js';
import { sendDealerApprovalEmail, sendDealerRejectionEmail } from '../../utils/sendEmail.js';
import { NotificationService } from '../admin/service/notification.service.js';
import { AdminNotification } from '../admin/models/adminNotification.model.js';
import { AdminService } from '../admin/service/admin.service.js';

export class DealerService {
  /**
   * Submit Dealer Onboarding Application
   */
  static async submitApplication(data) {
    const cleanEmail = data.officialEmail.toLowerCase().trim();
    const cleanGstin = data.gstin.toUpperCase().trim();

    // 1. Check duplicate email in Users or Dealers
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      throw ApiError.conflict('An account with this official email already exists on GROVE.');
    }

    const existingGstin = await Dealer.findOne({ gstin: cleanGstin });
    if (existingGstin) {
      throw ApiError.conflict('A dealership with this GSTIN is already registered.');
    }

    // 2. Resolve Primary Category
    let category = null;
    if (data.primaryCategory.match(/^[0-9a-fA-F]{24}$/)) {
      category = await Category.findById(data.primaryCategory);
    } else {
      category = await Category.findOne({
        $or: [{ name: data.primaryCategory }, { slug: data.primaryCategory.toLowerCase().replace(/ & /g, '-').replace(/\s+/g, '-') }]
      });
    }

    if (!category) {
      throw ApiError.badRequest(`Selected primary category '${data.primaryCategory}' is invalid.`);
    }

    // 3. Generate sequential Dealer Code (e.g. DEALER_001)
    const count = await Dealer.countDocuments();
    const dealerCode = `DEALER_${String(count + 1).padStart(3, '0')}`;

    // 4. Create base user account (initially inactive / pending password setup)
    const initialPlaceholderPassword = generateSecurePassword(16);
    const user = new User({
      name: data.ownerName.trim(),
      email: cleanEmail,
      phone: data.phone.trim(),
      password: initialPlaceholderPassword,
      role: ROLES.DEALER,
      status: 'ACTIVE',
      mustChangePassword: true
    });
    await user.save();

    // 5. Create Dealer record
    const dealer = new Dealer({
      user: user._id,
      dealerCode,
      businessName: data.businessName.trim(),
      businessType: data.businessType,
      primaryCategory: category._id,
      primaryCategoryName: category.name,
      ownerName: data.ownerName.trim(),
      officialEmail: cleanEmail,
      phone: data.phone.trim(),
      gstin: cleanGstin,
      pan: (data.pan || '').toUpperCase().trim(),
      businessAddress: data.businessAddress,
      warehouseAddress: data.warehouseAddress.trim(),
      location: {
        type: 'Point',
        coordinates: [data.coordinates?.lng || 73.8567, data.coordinates?.lat || 18.5204]
      },
      status: DEALER_STATUS.PENDING,
      storeSettings: {
        description: data.businessDescription || '',
        tagline: `${category.name} Certified Dealer`,
        operatingHours: 'Mon - Sat: 08:30 AM - 07:30 PM',
        isOpen: true,
        fulfillmentSLA: 99.0
      },
      kycDocuments: [
        { name: 'GSTIN Registration Certificate', url: 'https://docs.grove.com/sample-gstin.pdf', status: 'Under Review' },
        { name: 'Bank Cancelled Cheque', url: 'https://docs.grove.com/sample-cheque.pdf', status: 'Under Review' }
      ]
    });

    await dealer.save();

    // Trigger Admin Notification for the Bell Icon
    await NotificationService.createNotification({
      sourceType: 'DEALER',
      sourceId: dealer._id,
      sourceName: dealer.businessName,
      category: 'DEALER_ONBOARDING',
      priority: 'NORMAL',
      title: 'New Dealer Application Submitted',
      message: `${dealer.businessName} (${dealer.ownerName}) applied under ${dealer.primaryCategoryName}.`,
      entityType: 'dealer',
      entityId: dealer._id.toString(),
      actionUrl: '/admin/dealers',
      metadata: { gstin: dealer.gstin, phone: dealer.phone }
    });

    return {
      dealerCode: dealer.dealerCode,
      businessName: dealer.businessName,
      officialEmail: dealer.officialEmail,
      primaryCategory: dealer.primaryCategoryName,
      status: dealer.status,
      message: 'Dealership application submitted successfully. GROVE Operations will review your credentials.'
    };
  }

  /**
   * Super Admin Approves Dealer Application
   * Generates 12-char single-use temp password, emails dealer, and activates account.
   */
  static async approveDealer(dealerId, adminUser, options = {}) {
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) {
      throw ApiError.notFound('Dealer not found.');
    }

    if (dealer.status === DEALER_STATUS.APPROVED) {
      throw ApiError.badRequest('Dealer application is already approved.');
    }

    // 1. Generate 12-character secure temporary password
    const temporaryPassword = generateSecurePassword(12);
    const tempHash = await hashPassword(temporaryPassword);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // exactly 24 hours

    // 2. Dispatch credentials via Nodemailer
    try {
     console.log(`📨 [DEALER APPROVAL] Sending email to: ${dealer.officialEmail}`);
      const mailRes = await sendDealerApprovalEmail({
        to: dealer.officialEmail,
        ownerName: dealer.ownerName,
        businessName: dealer.businessName,
        temporaryPassword,
        expiryHours: 24
      });
      console.log(`✅ [DEALER APPROVAL] Email successfully sent:`, mailRes);
    } catch (emailErr) {
      console.error(`❌ [DEALER APPROVAL] Email delivery failed:`, emailErr.message);
    }

    // 3. Update dealer record with hashed temporary password
    dealer.status = DEALER_STATUS.APPROVED;
    dealer.commissionRate = options.commissionRate ?? dealer.commissionRate;
    dealer.tier = options.tier ?? dealer.tier;
    dealer.payoutHold = false;
    dealer.temporaryPassword = {
      hash: tempHash,
      expiresAt,
      isUsed: false,
      mustChange: true
    };

    dealer.kycDocuments = dealer.kycDocuments.map((doc) => ({
      ...doc.toObject(),
      status: 'Verified'
    }));

    dealer.approvalHistory.push({
      action: 'APPROVED',
      actionBy: adminUser.id,
      timestamp: new Date(),
      reason: options.notes || 'KYC verified and approved by Super Admin'
    });

    await dealer.save();

    await AdminService.recordAuditLog({
      action: 'DEALER_APPROVED', actor: adminUser.id, actorRole: adminUser.role,
      targetEntity: 'Dealer', targetId: dealer._id.toString(),
      details: `Dealer application approved for ${dealer.businessName}.`,
      ipAddress: adminUser.ipAddress || '', userAgent: adminUser.userAgent || ''
    });

    // 4. Update linked User record password to the temporary password
    const user = await User.findById(dealer.user);
    if (user) {
      user.password = temporaryPassword; // will be hashed by userSchema pre-save
      user.mustChangePassword = true;
      user.status = 'ACTIVE';
      await user.save();
    }

    // 5. Mark pending admin notification as read
    try {
      await AdminNotification.updateMany(
        { entityId: dealer._id.toString(), category: 'DEALER_ONBOARDING', isRead: false },
        { isRead: true, readAt: new Date() }
      );
    } catch (e) {
      console.warn('Failed to resolve dealer notification:', e.message);
    }

    return {
      message: `Dealer '${dealer.businessName}' successfully approved. Credentials dispatched to ${dealer.officialEmail}.`,
      dealer: {
        id: dealer._id,
        dealerCode: dealer.dealerCode,
        businessName: dealer.businessName,
        officialEmail: dealer.officialEmail,
        status: dealer.status,
        primaryCategoryName: dealer.primaryCategoryName,
        temporaryPasswordExpiry: expiresAt
      }
    };
  }

  /**
   * Super Admin Rejects Dealer Application
   */
 
static async rejectDealer(dealerId, adminUser, reason) {
  const dealer = await Dealer.findById(dealerId);

  if (!dealer) {
    throw ApiError.notFound('Dealer not found.');
  }

  // 1. Check status BEFORE changing it
  if (dealer.status === DEALER_STATUS.REJECTED) {
    throw ApiError.badRequest(
      'This dealer application has already been rejected.'
    );
  }

  if (dealer.status === DEALER_STATUS.APPROVED) {
    throw ApiError.badRequest(
      'An approved dealer cannot be rejected through this action.'
    );
  }

  // 2. Update dealer status
  dealer.status = DEALER_STATUS.REJECTED;

  dealer.approvalHistory.push({
    action: 'REJECTED',
    actionBy: adminUser.id,
    timestamp: new Date(),
    reason
  });

  await dealer.save();

  await AdminService.recordAuditLog({
    action: 'DEALER_REJECTED', actor: adminUser.id, actorRole: adminUser.role,
    targetEntity: 'Dealer', targetId: dealer._id.toString(),
    details: `Dealer application rejected. Reason: ${reason || 'Not provided'}`,
    ipAddress: adminUser.ipAddress || '', userAgent: adminUser.userAgent || ''
  });

  // 3. Resolve admin notification
  try {
    await AdminNotification.updateMany(
      {
        entityId: dealer._id.toString(),
        category: 'DEALER_ONBOARDING',
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );
  } catch (error) {
    console.warn(
      'Failed to resolve dealer notification:',
      error.message
    );
  }

  // 4. Send rejection email
  let emailSent = false;

  try {
    const emailResult = await sendDealerRejectionEmail({
      to: dealer.officialEmail,
      ownerName: dealer.ownerName,
      businessName: dealer.businessName,
      reason
    });

    emailSent = emailResult.success === true;

    if (emailSent) {
      console.log('✅ Rejection email accepted by SMTP');
    } else {
      console.error('❌ Rejection email failed:', emailResult);
    }

  } catch (error) {
    console.error('❌ Rejection email error:', error.message);
  }

  // 5. Return result
  return {
    message: `Dealer application for '${dealer.businessName}' rejected.`,
    emailSent
  };
}


  /**
   * Suspend or Reactivate Dealer
   */
  static async toggleStatus(dealerId, adminUser, newStatus, reason = '') {
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) {
      throw ApiError.notFound('Dealer not found.');
    }

    dealer.status = newStatus;
    dealer.approvalHistory.push({
      action: newStatus === DEALER_STATUS.SUSPENDED ? 'SUSPENDED' : 'REACTIVATED',
      actionBy: adminUser.id,
      timestamp: new Date(),
      reason
    });

    await dealer.save();

    await AdminService.recordAuditLog({
      action: 'DEALER_STATUS_CHANGED', actor: adminUser.id, actorRole: adminUser.role,
      targetEntity: 'Dealer', targetId: dealer._id.toString(),
      details: `Dealer status changed to ${newStatus}. Reason: ${reason || 'Not provided'}`,
      ipAddress: adminUser.ipAddress || '', userAgent: adminUser.userAgent || ''
    });

    // Also update linked user status
    await User.findByIdAndUpdate(dealer.user, {
      status: newStatus === DEALER_STATUS.SUSPENDED ? 'SUSPENDED' : 'ACTIVE'
    });

    return { message: `Dealer status changed to ${newStatus}.`, dealer };
  }

  /**
   * Dealer Updates Store Settings
   * Server strictly prevents modification of businessName, gstin, primaryCategory, warehouseAddress.
   */
  static async updateStoreSettings(dealerId, settingsData) {
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) {
      throw ApiError.notFound('Dealer not found.');
    }

    // Only allow updating safe fields
    if (settingsData.tagline !== undefined) dealer.storeSettings.tagline = settingsData.tagline;
    if (settingsData.description !== undefined) dealer.storeSettings.description = settingsData.description;
    if (settingsData.operatingHours !== undefined) dealer.storeSettings.operatingHours = settingsData.operatingHours;
    if (settingsData.isOpen !== undefined) dealer.storeSettings.isOpen = settingsData.isOpen;

    await dealer.save();

    return {
      message: 'Store settings updated successfully.',
      storeSettings: dealer.storeSettings
    };
  }

  static async updateAdminDealerDetails(dealerId, data, adminUser) {
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) throw ApiError.notFound('Dealer not found.');
    const before = {
      businessName: dealer.businessName, ownerName: dealer.ownerName, primaryCategory: dealer.primaryCategoryName,
      officialEmail: dealer.officialEmail, gstin: dealer.gstin, phone: dealer.phone,
      warehouseAddress: dealer.warehouseAddress, businessAddress: dealer.businessAddress?.toObject?.() || dealer.businessAddress
    };
    let category = null;
    if (data.primaryCategory) {
      category = /^[0-9a-fA-F]{24}$/.test(data.primaryCategory)
        ? await Category.findById(data.primaryCategory)
        : await Category.findOne({ name: data.primaryCategory });
      if (!category) throw ApiError.badRequest('Selected primary category does not exist.');
      dealer.primaryCategory = category._id;
      dealer.primaryCategoryName = category.name;
    }
    const normalizedEmail = data.officialEmail?.toLowerCase();
    if (normalizedEmail && normalizedEmail !== dealer.officialEmail) {
      const duplicate = await User.findOne({ email: normalizedEmail, _id: { $ne: dealer.user } });
      if (duplicate) throw ApiError.conflict('That email is already used by another account.');
      dealer.officialEmail = normalizedEmail;
    }
    if (data.gstin && data.gstin !== dealer.gstin) {
      const duplicate = await Dealer.findOne({ gstin: data.gstin, _id: { $ne: dealer._id } });
      if (duplicate) throw ApiError.conflict('That GSTIN is already registered.');
      dealer.gstin = data.gstin;
    }
    if (data.businessName !== undefined) dealer.businessName = data.businessName;
    if (data.ownerName !== undefined) dealer.ownerName = data.ownerName;
    if (data.phone !== undefined) dealer.phone = data.phone;
    if (data.warehouseAddress !== undefined) dealer.warehouseAddress = data.warehouseAddress;
    if (data.commissionRate !== undefined) dealer.commissionRate = data.commissionRate;
    for (const key of ['city', 'state', 'pincode']) {
      if (data[key] !== undefined) dealer.businessAddress[key] = data[key];
    }
    const user = await User.findById(dealer.user);
    if (user) {
      if (data.ownerName !== undefined) user.name = data.ownerName;
      if (normalizedEmail) user.email = normalizedEmail;
      if (data.phone !== undefined) user.phone = data.phone;
      await user.save();
    }
    dealer.approvalHistory.push({ action: 'DETAILS_UPDATED', actionBy: adminUser.id, reason: 'Dealer details edited by Super Admin' });
    await dealer.save();
    await AdminService.recordAuditLog({
      action: 'DEALER_DETAILS_UPDATED', actor: adminUser.id, actorRole: adminUser.role,
      targetEntity: 'Dealer', targetId: dealer._id.toString(),
      details: `Dealer details updated. Before: ${JSON.stringify(before)}; after: ${JSON.stringify(data)}`,
      ipAddress: adminUser.ipAddress || '', userAgent: adminUser.userAgent || ''
    });
    return dealer;
  }

  static async resetDealerCredentials(dealerId, adminUser) {
    const dealer = await Dealer.findById(dealerId);
    if (!dealer) throw ApiError.notFound('Dealer not found.');
    const user = await User.findById(dealer.user);
    if (!user) throw ApiError.notFound('Dealer login account not found.');
    const temporaryPassword = generateSecurePassword(12);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    dealer.temporaryPassword = { hash: await hashPassword(temporaryPassword), expiresAt, isUsed: false, mustChange: true };
    dealer.approvalHistory.push({ action: 'CREDENTIALS_RESET', actionBy: adminUser.id, reason: 'Credentials reset by Super Admin' });
    await dealer.save();
    user.password = temporaryPassword;
    user.mustChangePassword = true;
    // Credential resets must not reactivate accounts that an admin suspended,
    // nor grant pending applicants access to the dealer portal.
    user.status = dealer.status === 'APPROVED'
      ? 'ACTIVE'
      : dealer.status === 'SUSPENDED'
        ? 'SUSPENDED'
        : 'INACTIVE';
    await user.save();
    let emailSent = false;
    try {
      const result = await sendDealerApprovalEmail({
        to: dealer.officialEmail, ownerName: dealer.ownerName, businessName: dealer.businessName,
        temporaryPassword, expiryHours: 24
      });
      emailSent = result?.success !== false;
    } catch (error) {
      console.error('Dealer credential reset email failed:', error.message);
    }
    await AdminService.recordAuditLog({
      action: 'DEALER_CREDENTIALS_RESET', actor: adminUser.id, actorRole: adminUser.role,
      targetEntity: 'Dealer', targetId: dealer._id.toString(),
      details: `Dealer login credentials reset; notification ${emailSent ? 'sent' : 'failed'}.`,
      ipAddress: adminUser.ipAddress || '', userAgent: adminUser.userAgent || ''
    });
    return { message: emailSent ? 'Temporary credentials sent to the dealer email.' : 'Credentials reset, but email delivery failed. Re-send after checking email configuration.' };
  }

  /**
   * Get Dealer Profile
   */
  static async getProfile(dealerId) {
    const dealer = await Dealer.findById(dealerId).populate('primaryCategory', 'name slug commissionRate');
    if (!dealer) {
      throw ApiError.notFound('Dealer not found.');
    }
    return dealer;
  }

  /**
   * Get All Dealers (Admin)
   */
  static async getAllDealers(filters = {}, pagination = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.category) query.primaryCategory = filters.category;
    if (filters.search) {
      query.$or = [
        { businessName: { $regex: filters.search, $options: 'i' } },
        { dealerCode: { $regex: filters.search, $options: 'i' } },
        { officialEmail: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const page = parseInt(pagination.page, 10) || 1;
    const limit = parseInt(pagination.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [dealers, total] = await Promise.all([
      Dealer.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Dealer.countDocuments(query)
    ]);

    return {
      dealers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Public directory response: deliberately excludes contact, KYC, bank, and approval data.
  static async getPublicDealers({ page = 1, limit = 20 } = {}) {
    page = Math.max(1, Number.parseInt(page, 10) || 1);
    limit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    const query = { status: DEALER_STATUS.APPROVED };
    const [dealers, total] = await Promise.all([
      Dealer.find(query)
        .select('businessName dealerCode primaryCategory primaryCategoryName location storeSettings.tagline storeSettings.description storeSettings.operatingHours storeSettings.isOpen')
        .populate('primaryCategory', 'name slug')
        .sort({ businessName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Dealer.countDocuments(query)
    ]);
    return { dealers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
}

