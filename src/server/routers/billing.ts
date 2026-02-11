// ============================================================
// LegacyLens — Billing Router (Stripe Integration)
// ============================================================

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, logger } from '../trpc.js';
import Stripe from 'stripe';

// Stripe client — lazy-initialized only when a key is provided
const stripeKey = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = null;
if (stripeKey) {
  stripe = new Stripe(stripeKey, {
    apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
  });
}

function getStripe(): Stripe {
  if (!stripe) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env to enable billing.',
    });
  }
  return stripe;
}

export const billingRouter = router({
  // Get current subscription status
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const subscription = await ctx.prisma.subscription.findFirst({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      tier: ctx.user.subscriptionTier,
      credits: ctx.user.credits,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    };
  }),

  // Create Stripe checkout session
  createCheckout: protectedProcedure
    .input(
      z.object({
        tier: z.enum(['pro', 'team']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const priceIds: Record<string, string> = {
        pro: process.env.STRIPE_PRO_PRICE_ID || '',
        team: process.env.STRIPE_TEAM_PRICE_ID || '',
      };

      const priceId = priceIds[input.tier];
      if (!priceId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid subscription tier',
        });
      }

      // Find or create Stripe customer
      let subscription = await ctx.prisma.subscription.findFirst({
        where: { userId: ctx.user.id },
      });

      let customerId: string;

      if (subscription?.stripeCustomerId) {
        customerId = subscription.stripeCustomerId;
      } else {
        const customer = await getStripe().customers.create({
          email: ctx.user.email,
          metadata: { userId: ctx.user.id },
        });
        customerId = customer.id;
      }

      // Create checkout session
      const session = await getStripe().checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL}/account?success=true`,
        cancel_url: `${process.env.FRONTEND_URL}/account?canceled=true`,
        metadata: {
          userId: ctx.user.id,
          tier: input.tier,
        },
      });

      logger.info({ userId: ctx.user.id, tier: input.tier }, 'Stripe checkout created');

      return { url: session.url };
    }),

  // Create Stripe customer portal session (manage subscription)
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const subscription = await ctx.prisma.subscription.findFirst({
      where: { userId: ctx.user.id },
    });

    if (!subscription?.stripeCustomerId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No active subscription found',
      });
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/account`,
    });

    return { url: session.url };
  }),

  // Get usage history
  getUsageHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const logs = await ctx.prisma.usageLog.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: 'desc' },
        take: input.limit,
        select: {
          id: true,
          action: true,
          costCredits: true,
          createdAt: true,
          projectId: true,
        },
      });

      return logs;
    }),
});
