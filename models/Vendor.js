'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = (sequelize, DataTypes) => {
  const Vendor = sequelize.define(
    "Vendor",
    {
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      contact_name: {
        type: DataTypes.STRING(255),
        allowNull: true, // Optional: contact person's name
      },
      contact_email: {
        type: DataTypes.STRING(255),
        allowNull: true, // Optional: vendor's contact email
      },
      contact_phone: {
        type: DataTypes.STRING(50),
        allowNull: true, // Optional: vendor's contact phone number
      },
      address: {
        type: DataTypes.STRING(255),
        allowNull: true, // Optional: vendor's address
      },
      status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true, // Default is active (true)
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW, // Set default to current time
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW, // Set default to current time
      },
    },
    {
      tableName: "vendors",
      timestamps: true, // Ensures `created_at` and `updated_at` fields are included
      paranoid: false, // Soft delete is not used here, records will be deleted permanently
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  // Define associations (Vendor to Asset relationship)
  Vendor.associate = function (models) {
    // One vendor can supply many assets, so defining the relationship
    Vendor.hasMany(models.Asset, {
      foreignKey: 'vendor_id',
      onDelete: 'SET NULL', // If the vendor is deleted, set the vendor_id in the asset to NULL
    });
  };

  return Vendor;
};
