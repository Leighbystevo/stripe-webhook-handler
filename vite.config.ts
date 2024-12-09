import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import express from 'express';
import Stripe from 'stripe';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      {
        name: 'stripe-api',
        configureServer(server) {
          server.middlewares.use(express.json());

          // Sync products endpoint
          server.middlewares.use('/api/stripe/sync-products', async (req, res) => {
            if (req.method !== 'POST') {
              res.setHeader('Allow', 'POST');
              return res.status(405).json({ error: 'Method Not Allowed' });
            }

            try {
              const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
                apiVersion: '2023-10-16',
              });

              const products = await stripe.products.list({
                active: true,
                expand: ['data.default_price'],
              });

              const formattedProducts = products.data.map(product => {
                const price = product.default_price as Stripe.Price;
                return {
                  id: product.id,
                  name: product.name,
                  description: product.description || '',
                  price: price?.unit_amount ? price.unit_amount / 100 : 0,
                  stripePriceId: price?.id,
                  features: product.features?.map(f => f.name) || [],
                  maxPlayers: product.metadata.maxPlayers ? parseInt(product.metadata.maxPlayers) : -1,
                  maxUsers: product.metadata.maxUsers ? parseInt(product.metadata.maxUsers) : 1,
                  sponsorshipFeePercentage: product.metadata.sponsorshipFeePercentage 
                    ? parseFloat(product.metadata.sponsorshipFeePercentage) 
                    : 5,
                  isActive: product.active,
                  availableForNewSubscriptions: true,
                  trialDays: 14,
                  currency: price?.currency?.toUpperCase() || 'AUD',
                  createdAt: new Date(product.created * 1000),
                  updatedAt: new Date(),
                };
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ products: formattedProducts }));
            } catch (error) {
              console.error('Error fetching Stripe products:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ 
                error: error instanceof Error ? error.message : 'Failed to fetch products' 
              }));
            }
          });

          // Webhook endpoint
          server.middlewares.use('/api/webhooks/stripe/connect', express.raw({ type: 'application/json' }), async (req, res) => {
            if (req.method !== 'POST') {
              res.setHeader('Allow', 'POST');
              return res.status(405).json({ error: 'Method Not Allowed' });
            }

            const sig = req.headers['stripe-signature'];
            if (!sig) {
              return res.status(400).json({ error: 'Missing stripe-signature header' });
            }

            try {
              const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
                apiVersion: '2023-10-16',
              });

              const event = stripe.webhooks.constructEvent(
                req.body,
                sig,
                env.STRIPE_CONNECT_WEBHOOK_SECRET
              );

              // Handle the webhook event
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
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env': env,
    },
  };
});