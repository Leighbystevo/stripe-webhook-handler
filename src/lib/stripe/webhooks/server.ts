import express from 'express';
import Stripe from 'stripe';
import { handleWebhookEvent } from './index';

const app = express();

// Use raw body for Stripe webhook verification
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });

    const event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET!
    );

    const result = await handleWebhookEvent(event);
    
    if (!result.success) {
      throw new Error(result.error?.toString() || 'Webhook handling failed');
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});