'use strict';
module.exports = (sequelize, DataTypes) => {
  const FinancialInformation = sequelize.define('FinancialInformation', {
    capitalization_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    end_of_life_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    capitalization_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    depreciation_percentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    accumulated_depreciation: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    scrap_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    },
    income_tax_depreciation_percentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,  // Default value for active status
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,  // Can be null to indicate the record is not deleted
      defaultValue: null,  // Default value is null
    }
    
  }, {
    tableName: 'FinancialInformations',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  return FinancialInformation;
};
