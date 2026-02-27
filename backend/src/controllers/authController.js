const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const User = require('../models/User');
const { config } = require('../config/config');
const asyncHandler = require('../utils/asyncHandler');

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['patient', 'doctor']),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

const generateToken = (id, secret, expires) => {
  return jwt.sign({ id }, secret, { expiresIn: expires });
};

exports.signup = asyncHandler(async (req, res) => {
  const validation = signupSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: validation.error.format() });
  }

  const { name, email, password, role, dateOfBirth, gender } = validation.data;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ success: false, message: 'User already exists' });
  }

  const user = await User.create({
    name,
    email,
    passwordHash: password, // Pre-save hook will hash this
    role,
    dateOfBirth,
    gender,
    isVerified: role === 'patient' // Patients verified by default, doctors require admin
  });

  const accessToken = generateToken(user._id, config.jwt.secret, '15m');
  const refreshToken = generateToken(user._id, config.jwt.refreshSecret, '7d');

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      },
      accessToken,
      refreshToken
    }
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Please provide email and password' });
  }

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const accessToken = generateToken(user._id, config.jwt.secret, '15m');
  const refreshToken = generateToken(user._id, config.jwt.refreshSecret, '7d');

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      accessToken,
      refreshToken
    }
  });
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const newAccessToken = generateToken(user._id, config.jwt.secret, '15m');
    res.json({ success: true, data: { accessToken: newAccessToken } });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});
