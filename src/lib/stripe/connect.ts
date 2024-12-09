import Stripe from 'stripe';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { TenantConfig } from '@/types/tenant';
import { getAppUrl } from '@/lib/utils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export async function createStripeConnectAccount(tenantId: string) {
  try {
    // Create Connect account
    const account = await stripe.accounts.create({
      type: 'standard',
      country: 'AU',
      metadata: { tenantId }
    });

    // Update tenant config
    const configRef = doc(db, 'tenantConfig', tenantId);
    await updateDoc(configRef, {
      'stripeSettings.connectedAccountId': account.id,
      'stripeSettings.payoutsEnabled': false,
      updatedAt: new Date()
    });

    return account;
  } catch (error) {
    console.error('Error creating Connect account:', error);
    throw error;
  }
}

export async function getStripeConnectAccountLink(accountId: string) {
  try {
    const appUrl = getAppUrl();
    return await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/settings?tab=sponsorship`,
      return_url: `${appUrl}/settings?tab=sponsorship`,
      type: 'account_onboarding'
    });
  } catch (error) {
    console.error('Error creating account link:', error);
    throw error;
  }
}

export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  const configRef = doc(db, 'tenantConfig', tenantId);
  const configDoc = await getDoc(configRef);
  if (!configDoc.exists()) {
    throw new Error('Tenant config not found');
  }
  return configDoc.data() as TenantConfig;
}

export async function createSponsorshipPayment({
  amount,
  sponsorshipId,
  tenantId,
  sponsorEmail,
  platformFeePercent
}: {
  amount: number;
  sponsorshipId: string;
  tenantId: string;
  sponsorEmail: string;
  platformFeePercent: number;
}) {
  try {
    const tenantConfig = await getTenantConfig(tenantId);
    if (!tenantConfig.stripeSettings?.connectedAccountId) {
      throw new Error('Tenant has not connected their Stripe account');
    }

    // Calculate platform fee
    const platformFee = Math.round(amount * (platformFeePercent / 100));

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'aud',
      payment_method_types: ['card'],
      application_fee_amount: platformFee,
      transfer_data: {
        destination: tenantConfig.stripeSettings.connectedAccountId,
      },
      metadata: {
        sponsorshipId,
        tenantId
      },
      receipt_email: sponsorEmail
    });

    return {
      clientSecret: paymentIntent.client_secret,
      success: true
    };
  } catch (error) {
    console.error('Error creating sponsorship payment:', error);
    throw error;
  }
}