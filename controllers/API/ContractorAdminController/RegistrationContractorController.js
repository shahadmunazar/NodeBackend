const User = require("../../../models/user");
const jwt = require("jsonwebtoken");
// const UserRole = require("../../../models/userrole");
const { body, validationResult } = require("express-validator");
const moment = require("moment");
const Role = require("../../../models/role");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { Op } = require("sequelize");
const https = require("https");
require("dotenv").config();
const bcrypt = require("bcrypt");
const sequelize = require("../../../config/database");
const { DataTypes } = require("sequelize");
const ContractorOrganizationSafetyManagement = require("../../../models/contractororganizationsafetymanagement")(sequelize, DataTypes);
const ContractorPublicLiability = require("../../../models/contractorpublicliability")(sequelize, DataTypes);
const ContractorRegisterInsurance = require("../../../models/contractorregisterinsurance")(sequelize, DataTypes);
const RefreshToken = require("../../../models/refreshToken")(sequelize, DataTypes);
const ContractorInvitation = require("../../../models/contractorinvitations")(sequelize, DataTypes);
const ContractorRegistration = require("../../../models/ContractorRegistration")(sequelize, DataTypes);
// const { sendPasswordResetEmail } = require("../../../utils/sendPasswordResetEmail");
const Organization = require("../../../models/organization")(sequelize, DataTypes);
// const OrganizationSubscribeUser = require("../../../models/organization_subscribeuser")(sequelize, DataTypes);
const emailQueue = require("../../../queues/emailQueue"); // Ensure the emailQueue is correctly imported
const { response } = require("express");

const validateContractorRegistration = [
  body("contractor_invitation_id").notEmpty().isInt().withMessage("Contractor invitation ID is required"),
  body("invited_organization_by").optional().isInt(),
  body("abn_number").optional().isString(),
  body("contractor_company_name").optional().isString(),
  body("contractor_trading_name").optional().isString(),
  body("company_structure").optional().isIn(["Sole-Trader", "2-10 Employees", "11-50 Employees", "51-100 Employees", "Over 100 Employees"]),
  body("company_representative_first_name").optional().isString(),
  body("company_representative_last_name").optional().isString(),
  body("position_at_company").optional().isString(),
  body("address").optional().isString(),
  body("street").optional().isString(),
  body("suburb").optional().isString(),
  body("state").optional().isString(),
  body("contractor_phone_number")
    .optional()
    .matches(/^[0-9+\-\s()]{7,20}$/)
    .withMessage("Invalid phone number format"),
  body("service_to_be_provided").optional().isString(),
  body("covered_amount").optional().isInt(),
  body("have_professional_indemnity_insurance").optional().isIn(["Yes", "No", "N/A"]),
  body("is_staff_member_nominated").optional().isIn(["Yes", "No"]),
  body("provide_name_position_mobile_no").optional().isObject(),
  body("are_employees_provided_with_health_safety").optional().isIn(["Yes", "No"]),
  body("are_employees_appropriately_licensed_qualified_safety").optional().isIn(["Yes", "No", "N/A"]),
  body("are_employees_confirmed_as_competent_to_undertake_work").optional().isIn(["Yes", "No"]),
  body("do_you_all_sub_contractor_qualified_to_work").optional().isIn(["Yes", "No", "N/A"]),
  body("do_you_all_sub_contractor_required_insurance_public_liability").optional().isIn(["Yes", "No", "N/A"]),
  body("have_you_identified_all_health_safety_legislation").optional().isIn(["Yes", "No", "N/A"]),
  body("do_you_have_emergency_response").optional().isIn(["Yes", "No", "N/A"]),
  body("do_you_have_procedures_to_notify_the_applicable").optional().isIn(["Yes", "No", "N/A"]),
  body("do_you_have_SWMS_JSAS_or_safe_work").optional().isIn(["Yes", "No", "N/A"]),
  body("do_your_workers_conduct_on_site_review").optional().isIn(["Yes", "No"]),
  body("do_you_regularly_monitor_compliance").optional().isIn(["Yes", "No"]),
  body("do_you_have_procedures_circumstances").optional().isIn(["Yes", "No"]),
  body("have_you_been_prosecuted_health_regulator").optional().isIn(["Yes", "No"]),
  body("submission_status").optional().isIn(["confirm_submit", "let_me_check", "i_do_it_later", "save_and_come_back_later"]),
  body("employee_insure_doc_id").optional().isInt(),
  body("public_liability_doc_id").optional().isInt(),
  body("organization_safety_management_id").optional().isInt(),
];

const CreateContractorRegistration = async (req, res) => {
  try {
    await Promise.all(validateContractorRegistration.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { id, contractor_invitation_id, abn_number, new_start } = req.body;
    let existing = null;
    if (id) {
      existing = await ContractorRegistration.findOne({ where: { id } });
    }

    if (!existing && !new_start) {
      return res.status(404).json({
        success: false,
        message: "Contractor registration not found and new_start is false.",
      });
    }

    if (contractor_invitation_id) {
      const invitationExists = await ContractorInvitation.findOne({
        where: { id: contractor_invitation_id },
      });

      if (!invitationExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid contractor_invitation_id: no matching record found.",
        });
      }
    }

    const updatableFields = [
      "contractor_invitation_id",
      "invited_organization_by",
      "abn_number",
      "contractor_company_name",
      "contractor_trading_name",
      "company_structure",
      "company_representative_first_name",
      "company_representative_last_name",
      "position_at_company",
      "address",
      "street",
      "suburb",
      "state",
      "contractor_phone_number",
      "service_to_be_provided",
      "covered_amount",
      "have_professional_indemnity_insurance",
      "is_staff_member_nominated",
      "provide_name_position_mobile_no",
      "are_employees_provided_with_health_safety",
      "are_employees_appropriately_licensed_qualified_safety",
      "are_employees_confirmed_as_competent_to_undertake_work",
      "do_you_all_sub_contractor_qualified_to_work",
      "do_you_all_sub_contractor_required_insurance_public_liability",
      "have_you_identified_all_health_safety_legislation",
      "do_you_have_emergency_response",
      "do_you_have_procedures_to_notify_the_applicable",
      "do_you_have_SWMS_JSAS_or_safe_work",
      "do_your_workers_conduct_on_site_review",
      "do_you_regularly_monitor_compliance",
      "do_you_have_procedures_circumstances",
      "have_you_been_prosecuted_health_regulator",
      "submission_status",
      "employee_insure_doc_id",
      "public_liability_doc_id",
      "organization_safety_management_id",
    ];

    const fieldsToUse = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        fieldsToUse[field] = req.body[field];
      }
    });

    if (new_start === true || !existing) {
      // Check ABN duplication for new
      if (abn_number) {
        const abnExists = await ContractorRegistration.findOne({
          where: {
            abn_number,
          },
        });

        if (abnExists) {
          return res.status(400).json({
            success: false,
            message: "This ABN number is already used by another contractor.",
          });
        }
      }

      // Fallback to values from old record if it existed
      if (existing) {
        fieldsToUse.contractor_invitation_id = existing.contractor_invitation_id;
        fieldsToUse.invited_organization_by = existing.invited_organization_by;
      }

      const newRegistration = await ContractorRegistration.create(fieldsToUse);

      return res.status(201).json({
        success: true,
        status: 201,
        message: "New contractor registration created successfully.",
        data: newRegistration,
      });
    } else {
      
      if (abn_number && abn_number !== existing.abn_number) {
        const abnExists = await ContractorRegistration.findOne({
          where: {
            abn_number,
            id: { [Op.ne]: id },
          },
        });

        // if (abnExists) {
        //   return res.status(400).json({
        //     success: false,
        //     message: "This ABN number is already used by another contractor.",
        //   });
        // }
      }

      await existing.update(fieldsToUse);

      return res.status(200).json({
        success: true,
        status: 200,
        message: "Contractor registration updated successfully.",
        data: existing,
      });
    }
  } catch (error) {
    console.error("Error in ContractorRegistration:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};





const UploadInsuranceContrator = async (req, res) => {
  try {
    const { contractor_id, end_date, coverage_amount } = req.body;

    if (!contractor_id || !end_date) {
      return res.status(400).json({ message: "Contractor ID and insurance end date are required." });
    }

    const file = req.files?.contractor_insurance?.[0];
    if (!file) {
      return res.status(400).json({ message: "Insurance document file is required." });
    }

    const document_url = file.path.replace(/\\/g, "/"); // File path on server
    const original_file_name = file.originalname;       // Actual uploaded file name

    const contractor = await ContractorRegistration.findOne({
      where: { id: contractor_id },
    });

    if (!contractor) {
      return res.status(404).json({ message: "Contractor not found." });
    }

    let insuranceRecord = await ContractorRegisterInsurance.findOne({
      where: { contractor_id },
    });

    if (insuranceRecord) {
      await insuranceRecord.update({
        end_date,
        coverage_amount,
        document_url,
        original_file_name,
      });
    } else {
      insuranceRecord = await ContractorRegisterInsurance.create({
        contractor_id,
        end_date,
        coverage_amount,
        document_url,
        original_file_name,
      });
    }

    await contractor.update({
      employee_insure_doc_id: insuranceRecord.id,
      covered_amount: coverage_amount
    });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Contractor insurance uploaded and updated successfully.",
      data: insuranceRecord,
    });

  } catch (err) {
    console.error("UploadInsuranceContrator error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

  
  

const UploadPublicLiability = async (req, res) => {
  try {
    const { contractor_id, end_date } = req.body;

    if (!contractor_id || !end_date) {
      return res.status(400).json({ message: "Contractor ID and insurance end date are required." });
    }

    const file = req.files?.contractor_liability?.[0];
    if (!file) {
      return res.status(400).json({ message: "Public liability document file is required." });
    }

    const public_liabilty_file_url = file.path.replace(/\\/g, "/");
    const original_file_name = file.originalname;

    const contractor = await ContractorRegistration.findOne({
      where: { id: contractor_id },
    });

    if (!contractor) {
      return res.status(404).json({ message: "Contractor not found." });
    }

    // Check if liability record exists
    let liabilityRecord = await ContractorPublicLiability.findOne({
      where: { contractor_id },
    });

    if (liabilityRecord) {
      // Update existing record
      await liabilityRecord.update({
        end_date,
        public_liabilty_file_url,
        original_file_name,
      });
    } else {
      // Create new record
      liabilityRecord = await ContractorPublicLiability.create({
        contractor_id,
        end_date,
        public_liabilty_file_url,
        original_file_name,
      });
    }

    // Update contractor with reference ID
    await contractor.update({
      public_liability_doc_id: liabilityRecord.id,
    });

    return res.status(200).json({
      status: 200,
      message: "Contractor public liability insurance uploaded and updated successfully.",
      data: liabilityRecord,
    });

  } catch (err) {
    console.error("UploadPublicLiability error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


const UploadSafetyMNContractor = async (req, res) => {
  try {
    const { contractor_id } = req.body;

    if (!contractor_id) {
      return res.status(400).json({
        success: false,
        message: "Contractor ID is required.",
      });
    }

    const file = req.files?.safety_contractor_managment?.[0];
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Safety management document file is required.",
      });
    }

    const does_organization_safety_management_system_filename = file.path.replace(/\\/g, "/");
    const original_file_name = file.originalname;

    const contractor = await ContractorRegistration.findOne({
      where: { id: contractor_id },
    });

    if (!contractor) {
      return res.status(404).json({
        success: false,
        message: "Contractor not found.",
      });
    }

    let safetyRecord = await ContractorOrganizationSafetyManagement.findOne({
      where: { contractor_id },
    });

    if (safetyRecord) {
      await safetyRecord.update({
        does_organization_safety_management_system_filename,
        original_file_name,
      });
    } else {
      safetyRecord = await ContractorOrganizationSafetyManagement.create({
        contractor_id,
        does_organization_safety_management_system_filename,
        original_file_name,
      });
    }

    await contractor.update({
      organization_safety_management_id: safetyRecord.id,
    });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Contractor safety management document uploaded and updated successfully.",
      data: safetyRecord,
    });

  } catch (err) {
    console.error("UploadSafetyMNContractor error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

  

// const GetInsuranceContractor = async (req, res) => {
//   try {
//     const { contractor_id } = req.query;

//     if (!contractor_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Contractor ID is required",
//       });
//     }

//     const findInsDet = await ContractorRegisterInsurance.findOne({
//       where: {
//         contractor_id: contractor_id,
//       },
//     });

//     if (!findInsDet) {
//       return res.status(404).json({
//         success: false,
//         message: "No insurance details found for this contractor.",
//       });
//     }

//     const full_doc_url = findInsDet.document_url;
//     const full_url = `${process.env.BACKEND_URL}/${full_doc_url}`;

//     return res.status(200).json({
//       success: true,
//       status: 200,
//       message: "Contractor insurance details retrieved successfully.",
//       data: findInsDet,
//       fullUrl: full_url,
//     });
//   } catch (error) {
//     console.error("Error in GetInsuranceContractor:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

//All type public insurance

const GetInsuranceContractor = async (req, res) => {
    try {
      const { contractor_id, type } = req.query;
  
      if (!contractor_id || !type) {
        return res.status(400).json({
          success: false,
          status:400,
          message: "Contractor ID and document type are required.",
        });
      }
  
      let model, fieldName, notFoundMessage, successMessage;
  
      switch (type) {
        case "insurance":
          model = ContractorRegisterInsurance;
          fieldName = "document_url";
          notFoundMessage = "No insurance details found for this contractor.";
          successMessage = "Contractor insurance details retrieved successfully.";
          break;
  
        case "public":
          model = ContractorPublicLiability;
          fieldName = "public_liabilty_file_url";
          notFoundMessage = "No public liability insurance details found for this contractor.";
          successMessage = "Contractor public liability details retrieved successfully.";
          break;
  
        case "safety":
          model = ContractorOrganizationSafetyManagement;
          fieldName = "does_organization_safety_management_system_filename";
          notFoundMessage = "No safety management details found for this contractor.";
          successMessage = "Contractor safety management details retrieved successfully.";
          break;
        default:
          return res.status(400).json({
            success: false,
            status:400,
            message: "Invalid type. Valid types are: insurance, public, safety.",
          });
      }
  
      const record = await model.findOne({ where: { contractor_id } });
  
      if (!record) {
        return res.status(404).json({ status:404,success: false, message: notFoundMessage });
      }
  
      const documentPath = record[fieldName];
      const fullUrl = `${process.env.BACKEND_URL}/${documentPath}`;
  
      return res.status(200).json({
        success: true,
        status: 200,
        message: successMessage,
        data: record,
        fullUrl,
      });
    } catch (error) {
      console.error("GetContractorDocument error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  };
  

const GetPublicLiabilityContractor = async (req, res) => {
  try {
    const { contractor_id } = req.query;

    if (!contractor_id) {
      return res.status(400).json({
        success: false,
        message: "Contractor ID is required",
      });
    }

    const findInsDet = await ContractorPublicLiability.findOne({
      where: {
        contractor_id: contractor_id,
      },
    });

    if (!findInsDet) {
      return res.status(404).json({
        success: false,
        message: "No insurance details found for this contractor.",
      });
    }

    const full_doc_url = findInsDet.document_url;
    const full_url = `${process.env.BACKEND_URL}/${full_doc_url}`;

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Contractor public liability insurance details retrieved successfully.",
      data: findInsDet,
      fullUrl: full_url,
    });
  } catch (error) {
    console.error("Error in GetPublicLiabilityContractor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const GetSafetyMangmentContractor = async (req, res) => {
  try {
    const { contractor_id } = req.query;

    if (!contractor_id) {
      return res.status(400).json({
        success: false,
        message: "Contractor ID is required",
      });
    }

    const findInsDet = await ContractorOrganizationSafetyManagement.findOne({
      where: {
        contractor_id: contractor_id,
      },
    });

    if (!findInsDet) {
      return res.status(404).json({
        success: false,
        message: "No safety management details found for this contractor.",
      });
    }

    const full_doc_url = findInsDet.document_url;
    const full_url = `${process.env.BACKEND_URL}/${full_doc_url}`;

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Contractor safety management details retrieved successfully.",
      data: findInsDet,
      fullUrl: full_url,
    });
  } catch (error) {
    console.error("Error in GetSafetyManagementContractor:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const DeleteInsuranceContrator = async (req, res) => {
    try {
        const { contractor_id, type } = req.body;
    
        if (!contractor_id || !type) {
          return res.status(400).json({
            success: false,
            message: "Contractor ID and document type are required.",
          });
        }
        const documentMap = {
          employee_insurance: {
            model: ContractorRegisterInsurance,
            field: "employee_insure_doc_id",
            label: "Employee Insurance",
          },
          public_liability: {
            model: ContractorPublicLiability,
            field: "public_liability_doc_id",
            label: "Public Liability",
          },
          safety_management: {
            model: ContractorOrganizationSafetyManagement,
            field: "organization_safety_management_id",
            label: "Safety Management",
          },
        };
        const documentConfig = documentMap[type];
        console.log("doc", documentConfig);
        if (!documentConfig) {
          return res.status(400).json({
            success: false,
            message: "Invalid document type provided.",
          });
        }
        const insuranceRecord = await documentConfig.model.findOne({
          where: { contractor_id },
        });
        console.log("ins",insuranceRecord);
        if (!insuranceRecord) {
          return res.status(404).json({
            success: false,
            message: `No ${documentConfig.label} record found for this contractor.`,
          });
        }
        await insuranceRecord.destroy();
        const contractor = await ContractorRegistration.findOne({
          where: { id: contractor_id },
        });
        if (contractor) {
          await contractor.update({ [documentConfig.field]: null });
        }
        return res.status(200).json({
          success: true,
          status:200,
          message: `${documentConfig.label} record deleted and contractor reference updated.`,
        });
    
      } catch (error) {
        console.error("DeleteContractorDocument error:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      }
  };
  

const DeletePublicLContrator = async(req,res)=>{
    try {
        const { contractor_id } = req.body;
        if (!contractor_id) {
          return res.status(400).json({
            success: false,
            message: "Contractor ID is required.",
          });
        }
        const insuranceRecord = await ContractorPublicLiability.findOne({
          where: { contractor_id },
        });
        console.log("CheckData",insuranceRecord);
        if (!insuranceRecord) {
          return res.status(404).json({
            success: false,
            message: "No insurance record found for this contractor.",
          });
        }
        await insuranceRecord.destroy();
        const contractor = await ContractorRegistration.findOne({
          where: { id: contractor_id },
        });
    
        if (contractor) {
          await contractor.update({ public_liability_doc_id: null });
        }
        return res.status(200).json({
          success: true,
          message: "Insurance record deleted and contractor reference updated.",
        });
      } catch (error) {
        console.error("DeleteInsuranceContrator error:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      }
}

const DeleteSafetyMContrator = async(req,res)=>{
    try {
        const { contractor_id } = req.body;
        if (!contractor_id) {
          return res.status(400).json({
            success: false,
            message: "Contractor ID is required.",
          });
        }
        const insuranceRecord = await ContractorOrganizationSafetyManagement.findOne({
          where: { contractor_id },
        });
        console.log("CheckData",insuranceRecord);
        if (!insuranceRecord) {
          return res.status(404).json({
            success: false,
            message: "No insurance record found for this contractor.",
          });
        }
        await insuranceRecord.destroy();
        const contractor = await ContractorRegistration.findOne({
          where: { id: contractor_id },
        });
    
        if (contractor) {
          await contractor.update({ organization_safety_management_id: null });
        }
        return res.status(200).json({
          success: true,
          message: "Insurance record deleted and contractor reference updated.",
        });
      } catch (error) {
        console.error("DeleteInsuranceContrator error:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      }
}

const CheckContractorRegisterStatus = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }
    const getTimeAgo = (timestamp) => {
      const now = new Date();
      const past = new Date(timestamp);
      const diffInMs = now - past;
      const seconds = Math.floor(diffInMs / 1000);
      const minutes = Math.floor(diffInMs / (1000 * 60));
      const hours = Math.floor(diffInMs / (1000 * 60 * 60));
      const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const months = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
      const years = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));
      if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
      if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    };
    const findRecordContractor = await ContractorInvitation.findAll({
      where: {
        contractor_email: email
      }
    });
    if (findRecordContractor.length === 0) {
      return res.status(200).json({
        registered: false,
        message: "No contractor record found with this email."
      });
    }
    const enrichedData = await Promise.all(
      findRecordContractor.map(async (record) => {
        const plainRecord = record.toJSON();
        const registration = await ContractorRegistration.findAll({
          where: {
            contractor_invitation_id: plainRecord.id
          },
          attributes: [
            'id',
            'invited_organization_by',
            'abn_number',
            'contractor_company_name',
            'contractor_trading_name',
            'company_structure',
            'company_representative_first_name',
            'company_representative_last_name',
            'position_at_company',
            'address',
            'street',
            'suburb',
            'state',
            'contractor_phone_number',
            'service_to_be_provided',
            'employee_insure_doc_id',
            'public_liability_doc_id',
            'organization_safety_management_id',
            'submission_status'
          ]
        });
        let incompletePage = null;
        let formStatus = 'incomplete';
        if (registration) {
          if (registration.submission_status === 'confirm_submit') {
            incompletePage = null;
            formStatus = 'complete';
          } else {
            const requiredPage1Fields = [
              'invited_organization_by',
              'abn_number',
              'contractor_company_name',
              'contractor_trading_name',
              'company_structure',
              'company_representative_first_name',
              'company_representative_last_name',
              'position_at_company',
              'address',
              'street',
              'suburb',
              'state',
              'contractor_phone_number',
              'service_to_be_provided'
            ];
            const isPage1Incomplete = requiredPage1Fields.some(
              (field) => registration[field] === null || registration[field] === ''
            );
            if (isPage1Incomplete) {
              incompletePage = 1;
            } else if (!registration.employee_insure_doc_id) {
              incompletePage = 2;
            } else if (!registration.public_liability_doc_id) {
              incompletePage = 3;
            } else if (!registration.organization_safety_management_id) {
              incompletePage = 4;
            } else {
              formStatus = 'complete';
            }
          }
        }
        return {
          ...plainRecord,
          lastUpdatedAgo: getTimeAgo(plainRecord.updatedAt),
          registrationInfo: registration || null,
          incompletePage,
          formStatus
        };
      })
    );

    return res.status(200).json({
      registered: true,
      status: 200,
      data: enrichedData
    });
  } catch (error) {
    console.error("Error checking contractor register status:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};



const DeleteContractorRecords = async (req, res) => {
  try {
    const { contractor_id } = req.body;
    if (!contractor_id) {
      return res.status(400).json({ message: "Contractor ID is required." });
    }
    const contractorReg = await ContractorRegistration.findOne({
      where: { id: contractor_id }
    });
    if (!contractorReg) {
      return res.status(404).json({ message: "Contractor registration not found." });
    }
    await ContractorRegisterInsurance.destroy({
      where: { contractor_id: contractorReg.id }
    });
    await ContractorPublicLiability.destroy({
      where: { contractor_id: contractorReg.id }
    });
    await ContractorOrganizationSafetyManagement.destroy({
      where: { contractor_id: contractorReg.id }
    });
    await ContractorRegistration.destroy({
      where: { id: contractorReg.id }
    });
    return res.status(200).json({
      message: "Contractor registration and related documents deleted successfully."
    });
  } catch (error) {
    console.error("Error deleting contractor registration:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};



const GetContractorDetails = async (req, res) => {
  try {
    const { contractor_id } = req.query;

    if (!contractor_id) {
      return res.status(400).json({
        success: false,
        message: "Contractor ID is required.",
      });
    }

    const findDetails = await ContractorRegistration.findOne({
      where: {
        id: contractor_id
      }
    });

    if (!findDetails) {
      return res.status(404).json({
        success: false,
        message: "Contractor not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contractor details fetched successfully.",
      data: findDetails
    });

  } catch (error) {
    console.error("Error fetching contractor details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message
    });
  }
};




module.exports = {
  CreateContractorRegistration,
  UploadInsuranceContrator,
  UploadPublicLiability,
  UploadSafetyMNContractor,
  GetInsuranceContractor,
  GetPublicLiabilityContractor,
  GetSafetyMangmentContractor,
  DeleteInsuranceContrator,
  DeletePublicLContrator,
  DeleteSafetyMContrator,
  CheckContractorRegisterStatus,
  DeleteContractorRecords,
  GetContractorDetails
};
