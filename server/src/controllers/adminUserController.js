import mongoose from "mongoose";
import { User } from "../models/index.js";
import {
  badRequest,
  conflict,
  notFound,
} from "../utils/httpError.js";
import {
  hasField,
  parseAdminListQuery,
  readEnum,
  searchPattern,
} from "../utils/adminQuery.js";
import { serializeAdminUser } from "../utils/serializers.js";

const USER_ROLES = ["customer", "admin"];
const USER_STATUSES = ["active", "suspended"];

const findAdminUser = async (id) => {
  const text = String(id || "").trim();

  if (!text || !mongoose.isValidObjectId(text)) {
    throw notFound("User not found.");
  }

  const user = await User.findById(text);

  if (!user) {
    throw notFound("User not found.");
  }

  return user;
};

export const listAdminUsers = async (req, res) => {
  const query = parseAdminListQuery(req.query, {
    sortable: {
      name: "name",
      email: "email",
      joinedAt: "joinedAt",
      role: "role",
      status: "status",
      createdAt: "createdAt",
    },
    defaultSort: "createdAt",
    statuses: USER_STATUSES,
  });
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search) {
    const pattern = searchPattern(query.search);
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      // Only the fields the admin UI needs. passwordHash is never selected.
      .select("name email role status joinedAt lastLoginAt createdAt")
      .sort({ [query.sort]: query.direction, _id: query.direction })
      .limit(500),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      users: users.map(serializeAdminUser),
      total,
    },
  });
};

export const updateAdminUser = async (req, res) => {
  const user = await findAdminUser(req.params.id);
  const source = req.body || {};
  const role = hasField(source, "role")
    ? readEnum(source.role, "Role", USER_ROLES, { required: true })
    : user.role;
  const status = hasField(source, "status")
    ? readEnum(source.status, "Status", USER_STATUSES, { required: true })
    : user.status;

  if (!hasField(source, "role") && !hasField(source, "status")) {
    throw badRequest("Provide a role or status to update.");
  }

  const isSelf = String(user._id) === String(req.user._id);

  if (isSelf && role !== "admin") {
    throw badRequest("You cannot remove your own administrator access.");
  }

  if (isSelf && status !== "active") {
    throw badRequest("You cannot suspend your own administrator account.");
  }

  const removesActiveAdmin =
    user.role === "admin" &&
    user.status === "active" &&
    (role !== "admin" || status !== "active");

  if (removesActiveAdmin) {
    const remainingAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      role: "admin",
      status: "active",
    });

    if (remainingAdmins === 0) {
      throw conflict("At least one active administrator must remain.");
    }
  }

  user.role = role;
  user.status = status;
  await user.save();

  res.status(200).json({
    success: true,
    data: { user: serializeAdminUser(user) },
  });
};
