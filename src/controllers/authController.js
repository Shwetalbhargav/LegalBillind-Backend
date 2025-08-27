import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email to sign in.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '1d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// configure transporter once
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    let existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(token).digest('hex');


    const user = await User.create({
      name,
      email: email.toLowerCase(),
      role,
      passwordHash,
      verifyTokenHash,
      verifyExpires: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
    });
    const verifyUrl = `${process.env.APP_URL}/api/auth/verify-email?token=${token}`;
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: user.email,
      subject: 'Verify your email',
      html: `<p>Hi ${user.name},</p>
             <p>Confirm your email for Legal Billables:</p>
             <p><a href="${verifyUrl}">Verify my email</a></p>
             <p>This link expires in 24 hours.</p>`,
    });

    // Tell frontend to show the "Check your email" screen
    res.status(201).json({ success: true, message: 'Verification email sent' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Invalid link');

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    verifyTokenHash: hash,
    verifyExpires: { $gt: new Date() },
  });

  if (!user) return res.status(400).send('Link invalid or expired');

  user.emailVerified = true;
  user.verifyTokenHash = undefined;
  user.verifyExpires = undefined;
  await user.save();

  // Optionally auto-login by issuing your normal JWT here:
  const tokenJwt = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  // Redirect back to your app (SPA) with token or a success flag
  return res.redirect(`${process.env.FRONTEND_URL}/verified?token=${tokenJwt}`);
};

// 1) Request: create short-lived token and email link
export const requestMagicLink = async (req, res) => {
  try{
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    user = await User.create({
      name: email.split('@')[0],
      email: email.toLowerCase(),
      authProvider: 'magic',
      emailVerified: false,
      verifyTokenHash: tokenHash,
      verifyExpires: new Date(Date.now() + 15 * 60 * 1000)
    });
  }else {

  user.verifyTokenHash = tokenHash;
  user.verifyExpires = new Date(Date.now() + 1000 * 60 * 15); // 15 min
  await user.save();
  }
  const consumeUrl = `${process.env.APP_URL}/api/auth/magic/consume?token=${token}`;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: email.toLowerCase(),
    subject: 'Your sign-in link',
    html: `<p>Hi ${user.name},</p>
           <p>Click to sign in to Legal Billables:</p>
           <p><a href="${consumeUrl}">${consumeUrl}</a></p>
           <p>This link expires in 15 minutes and can be used once.</p>`,
  });

  return res.json({ success: true });
}catch(err){
  console.error('Magic link request error:', err);
  return res.status(500).json({ error: err.message || 'Failed to send link' });
};
}

// 2) Consume: verify token, issue JWT, redirect to SPA
export const consumeMagicLink = async (req, res) => {
  try{
  const { token } = req.query;
  if (!token) return res.status(400).send('Invalid link');

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    verifyTokenHash: hash,
    verifyExpires: { $gt: new Date() },
  });

  if (!user) return res.status(400).send('Link invalid or expired');

  user.emailVerified = true;
  user.verifyTokenHash = undefined; // single-use
  user.verifyExpires = undefined;
  await user.save();

  const jwtToken = jwt.sign({ id: user._id, role: user.role || 'Lawyer' }, process.env.JWT_SECRET, { expiresIn: '1d' });
  return res.redirect(`${process.env.FRONTEND_URL}/magic-ok?token=${jwtToken}`);
  }catch(err){
  console.error('Magic link consume error:', err);  
  res.status(500).json({ error: 'Server error' });  
  }

};
