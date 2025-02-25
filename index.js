require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Add this after creating the prisma client
prisma.$connect()
  .then(() => console.log('Database connected successfully'))
  .catch((err) => console.error('Database connection error:', err));

// Referral submission endpoint
app.post('/api/referrals', async (req, res) => {
  try {
    console.log('Received referral data:', req.body);

    const {
      referrerName,
      referrerEmail,
      referrerPhone,
      refereeName,
      refereeEmail,
      refereePhone,
      fieldOfWork,
      program
    } = req.body;

    // Log the extracted data
    console.log('Extracted data:', {
      referrerName,
      referrerEmail,
      referrerPhone,
      refereeName,
      refereeEmail,
      refereePhone,
      fieldOfWork,
      program
    });

    // Validate required fields
    const requiredFields = {
      referrerName: 'Referrer Name',
      referrerEmail: 'Referrer Email',
      refereeName: 'Referee Name',
      refereeEmail: 'Referee Email',
      fieldOfWork: 'Field of Work',
      program: 'Program'
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !req.body[key])
      .map(([_, label]) => label);

    if (missingFields.length > 0) {
      console.log('Missing fields:', missingFields);
      return res.status(400).json({
        error: `The following fields are required: ${missingFields.join(', ')}`
      });
    }

    // Validate email format
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(referrerEmail) || !emailRegex.test(refereeEmail)) {
      console.log('Invalid email format');
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Transaction to handle both referrer and referral creation/update
    const result = await prisma.$transaction(async (prisma) => {
      try {
        // Find or create referrer
        let referrer = await prisma.referrer.findUnique({
          where: { email: referrerEmail }
        });

        console.log('Existing referrer:', referrer);

        if (!referrer) {
          referrer = await prisma.referrer.create({
            data: {
              name: referrerName,
              email: referrerEmail,
              phone: referrerPhone,
              referralCount: 1
            }
          });
          console.log('Created new referrer:', referrer);
        } else {
          // Update existing referrer's count and details
          referrer = await prisma.referrer.update({
            where: { id: referrer.id },
            data: {
              referralCount: { increment: 1 },
              name: referrerName,
              phone: referrerPhone
            }
          });
          console.log('Updated existing referrer:', referrer);
        }

        // Create the referral
        const referral = await prisma.referral.create({
          data: {
            name: refereeName,
            email: refereeEmail,
            phone: refereePhone,
            fieldOfWork,
            program,
            referrerId: referrer.id
          },
          include: {
            referrer: true
          }
        });

        console.log('Created new referral:', referral);
        return { referrer, referral };
      } catch (error) {
        console.error('Transaction error:', error);
        throw error;
      }
    });

    // Send email notification to both admin and referee
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: 'New Referral Submission',
      html: `
        <h2>New Referral Received</h2>
        <h3>Referrer Details:</h3>
        <p><strong>Name:</strong> ${result.referrer.name}</p>
        <p><strong>Email:</strong> ${result.referrer.email}</p>
        <p><strong>Phone:</strong> ${result.referrer.phone || 'Not provided'}</p>
        <p><strong>Total Referrals:</strong> ${result.referrer.referralCount}</p>
        <h3>Referee Details:</h3>
        <p><strong>Name:</strong> ${result.referral.name}</p>
        <p><strong>Email:</strong> ${result.referral.email}</p>
        <p><strong>Phone:</strong> ${result.referral.phone || 'Not provided'}</p>
        <p><strong>Field of Work:</strong> ${result.referral.fieldOfWork}</p>
        <p><strong>Program:</strong> ${result.referral.program}</p>
      `
    };

    // Email to referee
    const refereeMailOptions = {
      from: process.env.EMAIL_USER,
      to: result.referral.email,
      subject: 'You have been referred to our program',
      html: `
        <h2>Welcome to Our Program!</h2>
        <p>Hello ${result.referral.name},</p>
        <p>You have been referred to our ${result.referral.program} program by ${result.referrer.name}.</p>
        <p>We're excited to have you join us! Our team will review your details and contact you soon.</p>
        <h3>Program Details:</h3>
        <p><strong>Selected Program:</strong> ${result.referral.program}</p>
        <p><strong>Your Field of Work:</strong> ${result.referral.fieldOfWork}</p>
        <br>
        <p>If you have any questions, feel free to reach out to us.</p>
        <p>Best regards,<br>The Team</p>
      `
    };

    // Send both emails
    await Promise.all([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(refereeMailOptions)
    ]);

    res.status(201).json({
      message: 'Referral submitted successfully',
      data: result
    });
  } catch (error) {
    console.error('Error processing referral:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all referrals endpoint
app.get('/api/referrals', async (req, res) => {
  try {
    const referrals = await prisma.referral.findMany({
      include: {
        referrer: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(referrals);
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single referral endpoint
app.get('/api/referrals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const referral = await prisma.referral.findUnique({
      where: { id: parseInt(id) },
      include: {
        referrer: true
      }
    });
    
    if (!referral) {
      return res.status(404).json({ error: 'Referral not found' });
    }
    
    res.json(referral);
  } catch (error) {
    console.error('Error fetching referral:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get referrer statistics
app.get('/api/referrers/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const referrer = await prisma.referrer.findUnique({
      where: { id: parseInt(id) },
      include: {
        referrals: {
          select: {
            status: true,
            program: true,
            createdAt: true
          }
        }
      }
    });
    
    if (!referrer) {
      return res.status(404).json({ error: 'Referrer not found' });
    }
    
    res.json(referrer);
  } catch (error) {
    console.error('Error fetching referrer stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update referral status endpoint
app.patch('/api/referrals/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedReferral = await prisma.referral.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.json(updatedReferral);
  } catch (error) {
    console.error('Error updating referral status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
