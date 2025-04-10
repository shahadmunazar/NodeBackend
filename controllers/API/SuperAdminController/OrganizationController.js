const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const sequelize = require("../../../config/database");
const { DataTypes } = require("sequelize");
const Organization = require("../../../models/organization")(sequelize, DataTypes);
const User = require("../../../models/user");
const OrganizationSubscribeUser = require('../../../models/organization_subscribeuser')(sequelize, DataTypes);
const UserRoles = require('../../../models/userrole');
const Roles = require('../../../models/role');

const Industry = require('../../../models/industry')(sequelize, DataTypes);
const Plan = require('../../../models/AllPlans')(sequelize, DataTypes);

// ✅ Validation
const validateOrganization = [
  body('organization_name').notEmpty().withMessage('Organization name is required'),
  body('industryId').optional().isInt().withMessage('Industry ID must be a number'),
  body('organization_address').optional().isString(),
  body('city').optional().isString(),
  body('state').optional().isString(),
  body('name').notEmpty().withMessage('Admin name is required'),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('user_name').optional().isString().withMessage('Username must be a string'),
  body('plan_id').notEmpty().withMessage('Plan ID is required'),
  body('role_id').notEmpty().withMessage('Role ID is required'),
  body('postal_code').optional().isLength({ max: 10 }),
  body('registration_id').optional().isString(),
  body('contact_phone_number').optional().matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Invalid phone format'),
  body('number_of_employees').optional().isIn(['1-10', '11-50', '51-200', '201-500', '500+']),
];

// ✅ Controller
const CreateOrganization = async (req, res) => {
    try {
      console.log('Files:', req.files);
  
      if (!req.files?.logo || !req.files?.agreement_paper) {
        return res.status(400).json({ success: false, message: 'Both logo and agreement paper are required' });
      }
  
      await Promise.all(validateOrganization.map(validation => validation.run(req)));
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }
  
      const {
        organization_name,
        industryId,
        organization_address,
        city,
        state,
        postal_code,
        registration_id,
        contact_phone_number,
        number_of_employees,
        name,
        email,
        user_name,
        plan_id,
        role_id,
      } = req.body;
  
      if (!email && !user_name) {
        return res.status(400).json({ success: false, message: 'Either email or username is required.' });
      }
  
      const logoPath = req.files.logo[0].path;
      const agreementPaperPath = req.files.agreement_paper[0].path;
  
      const newOrganization = await Organization.create({
        organization_name,
        industryId,
        organization_address,
        city,
        state,
        postal_code,
        registration_id,
        contact_phone_number,
        number_of_employees,
        logo: logoPath,
        plan_id,plan_id,
        agreement_paper: agreementPaperPath
      });
  
      const tempPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
  
      const newUser = await User.create({
        name,
        email,
        user_name,
        password: hashedPassword
      });
  
      const newUserRole = await UserRoles.create({
        userId: newUser.id,
        roleId: role_id
      });
  
      const newSubscription = await OrganizationSubscribeUser.create({
        user_id: newUser.id,
        org_id: newOrganization.id,
        plan_id: plan_id,
        validity_start_date: new Date(),
        validity_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      });
  
      return res.status(200).json({
        success: true,
        message: 'Organization, admin user, and subscription created successfully',
        organization: newOrganization,
        user: {
          ...newUser.toJSON(),
          plain_password: tempPassword
        },
        user_role: newUserRole,
        subscription: newSubscription
      });
  
    } catch (error) {
      console.error('Error in CreateOrganization:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };
  

// ✅ Password Generator
function generateTempPassword(length = 10) {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const number = '0123456789';
  const special = '@$!%*?&';
  const all = upper + lower + number + special;

  let password = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    number[Math.floor(Math.random() * number.length)],
    special[Math.floor(Math.random() * special.length)],
  ];

  for (let i = password.length; i < length; i++) {
    password.push(all[Math.floor(Math.random() * all.length)]);
  }

  return password.sort(() => 0.5 - Math.random()).join('');
}
const GetAllOrganization = async (req, res) => {
    try {
      const organizations = await Organization.findAll();
  
      if (!organizations || organizations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No organizations found',
        });
      }
  
      const orgSubscribersPromises = organizations.map(async (organization) => {
        // Fetch subscribers
        const subscribers = await OrganizationSubscribeUser.findAll({
          where: { org_id: organization.id },
        });
  
        // Get users
        const userPromises = subscribers.map(async (subscriber) => {
          const user = await User.findOne({
            where: { id: subscriber.user_id },
          });
          if (!user) return null;
  
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
          };
        });
  
        const users = await Promise.all(userPromises);
        const filteredUsers = users.filter((user) => user !== null);
  
        // Get roles
        const rolesPromises = subscribers.map(async (subscriber) => {
          const user = await User.findOne({ where: { id: subscriber.user_id } });
          if (!user) return null;
  
          const userRoles = await UserRoles.findAll({
            where: { userId: user.id },
          });
  
          const rolePromises = userRoles.map(async (userRole) => {
            const role = await Roles.findOne({
              where: { id: userRole.roleId },
            });
            return role ? role.name : null;
          });
  
          const roles = await Promise.all(rolePromises);
          return roles.filter((role) => role !== null);
        });
  
        const roles = await Promise.all(rolesPromises);
        const flattenedRoles = roles.flat().filter((role) => role);
  
        // ✅ Get Industry name
        let industryName = null;
        if (organization.industryId) {
          const industry = await Industry.findOne({
            where: { id: organization.industryId },
            attributes: ['name'],
          });
          industryName = industry ? industry.name : null;
        }
  
        // ✅ Get Plan name
        let planName = null;
        if (organization.plan_id) {
          const plan = await Plan.findOne({
            where: { id: organization.plan_id },
            attributes: ['name'],
          });
          planName = plan ? plan.name : null;
        }
  
        return {
          id: organization.id,
          organization_name: organization.organization_name,
          industryId: organization.industryId,
          industry_name: industryName,       // ✅ Added industry name
          plan_id: organization.plan_id,
          plan_name: planName,               // ✅ Added plan name
          organization_address: organization.organization_address,
          city: organization.city,
          state: organization.state,
          postal_code: organization.postal_code,
          users: filteredUsers,
          roles: flattenedRoles,
        };
      });
  
      const orgWithSubscribers = await Promise.all(orgSubscribersPromises);
  
      return res.status(200).json({
        success: true,
        message: 'Organizations and related data fetched successfully',
        data: orgWithSubscribers,
      });
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message,
      });
    }
  };
  
  
  
  
  
  
  
  

module.exports = {
  CreateOrganization,GetAllOrganization
};
