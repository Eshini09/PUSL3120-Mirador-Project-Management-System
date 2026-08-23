const User = require("../models/User");

const profileFields = "_id name email role bio avatarColor";
const allowedAvatarColors = [
    "INDIGO",
    "TEAL",
    "CORAL",
    "AMBER",
    "GREEN",
    "LAVENDER",
    "ROSE",
    "PEACH",
    "MINT",
    "SKY",
    "LILAC",
    "LEMON"
];

const getUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select(profileFields)
            .sort({ name: 1 });

        res.status(200).json({
            users
        });
    } catch (error) {
        console.error("Get users error:", error);

        res.status(500).json({
            message: "Failed to retrieve users"
        });
    }
};

const getAssignableUsers = async (req, res) => {
    try {
        let query = {};

        if (req.user.role === "PROJECT_MANAGER") {
            query = {
                role: { $ne: "ADMIN" }
            };
        } else if (req.user.role === "TEAM_MEMBER") {
            query = {
                _id: req.user.userId
            };
        }

        const users = await User.find(query)
            .select(profileFields)
            .sort({ name: 1 });

        res.status(200).json({
            users
        });
    } catch (error) {
        console.error("Get assignable users error:", error);

        res.status(500).json({
            message: "Failed to retrieve assignable users"
        });
    }
};

const updateMyProfile = async (req, res) => {
    try {
        const { name, bio, avatarColor } = req.body;
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({
                    message: "Name cannot be empty"
                });
            }

            user.name = name.trim();
        }

        if (bio !== undefined) {
            if (bio.length > 240) {
                return res.status(400).json({
                    message: "Bio must be 240 characters or fewer"
                });
            }

            user.bio = bio.trim();
        }

        if (avatarColor !== undefined) {
            if (!allowedAvatarColors.includes(avatarColor)) {
                return res.status(400).json({
                    message: "A valid avatar colour is required"
                });
            }

            user.avatarColor = avatarColor;
        }

        await user.save();

        res.status(200).json({
            message: "Profile updated successfully",
            user: {
                userId: user._id,
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                bio: user.bio,
                avatarColor: user.avatarColor
            }
        });
    } catch (error) {
        console.error("Update profile error:", error);

        res.status(500).json({
            message: "Failed to update profile"
        });
    }
};

const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const allowedRoles = [
            "ADMIN",
            "PROJECT_MANAGER",
            "TEAM_MEMBER"
        ];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                message: "A valid user role is required"
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (user.role === "ADMIN" && role !== "ADMIN") {
            const adminCount = await User.countDocuments({
                role: "ADMIN"
            });

            if (adminCount <= 1) {
                return res.status(400).json({
                    message: "At least one administrator is required"
                });
            }
        }

        user.role = role;
        await user.save();

        res.status(200).json({
            message: "User role updated successfully",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                bio: user.bio,
                avatarColor: user.avatarColor
            }
        });
    } catch (error) {
        console.error("Update user role error:", error);

        res.status(500).json({
            message: "Failed to update user role"
        });
    }
};

const deleteUser = async (req, res) => {
    try {
        if (req.params.id === req.user.userId) {
            return res.status(400).json({
                message: "You cannot delete your own account"
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (user.role === "ADMIN") {
            const adminCount = await User.countDocuments({
                role: "ADMIN"
            });

            if (adminCount <= 1) {
                return res.status(400).json({
                    message: "At least one administrator is required"
                });
            }
        }

        await user.deleteOne();

        res.status(200).json({
            message: "User deleted successfully"
        });
    } catch (error) {
        console.error("Delete user error:", error);

        res.status(500).json({
            message: "Failed to delete user"
        });
    }
};

module.exports = {
    getUsers,
    getAssignableUsers,
    updateMyProfile,
    updateUserRole,
    deleteUser
};
