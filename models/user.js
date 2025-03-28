const { Model, DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const sequelize = require("../config/database");
const UserRole = require("./userrole");
const Role = require("./role");

class User extends Model {
  async validatePassword(password) {
    return bcrypt.compare(password, this.password);
  }
}

User.init(
  {
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, allowNull: true, unique: true },
    username: { type: DataTypes.STRING, allowNull: true, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    otp: { type: DataTypes.STRING, allowNull: true },
    otpExpiresAt: { type: DataTypes.DATE, allowNull: true },
    loginAttemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    user_status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    invitation_status: {
      type: DataTypes.ENUM("pending", "accepted", "expired","sent"),
      allowNull: false,
      defaultValue: "pending",
    },
    invite_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invite_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "User",
    paranoid: true, // Enables Soft Delete (keeps deletedAt)
    timestamps: true, // Keeps createdAt & updatedAt
  }
);

// **Hash password before saving**
User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 10);
});

// **Define Associations**
User.belongsToMany(Role, { through: UserRole, foreignKey: "userId" });
Role.belongsToMany(User, { through: UserRole, foreignKey: "roleId" });

module.exports = User;
