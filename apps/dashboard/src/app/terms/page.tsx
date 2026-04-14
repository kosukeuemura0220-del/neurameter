import { LegalLayout } from '@/components/legal-layout';

export const metadata = {
  title: 'Terms of Service | NeuraMeter',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>Last updated: April 2026</p>

      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using NeuraMeter (&quot;Service&quot;), operated by NEURIA Inc. (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;),
        you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree,
        do not use the Service.
      </p>

      <h2>2. Description of Service</h2>
      <p>
        NeuraMeter is an AI cost monitoring and context engineering platform that helps
        developers track, analyze, and optimize the cost and efficiency of AI agent operations.
        The Service includes a dashboard, SDK, API, and MCP server.
      </p>

      <h2>3. Account Registration</h2>
      <p>
        You must provide accurate information when creating an account. You are responsible
        for maintaining the security of your account credentials and for all activities
        under your account.
      </p>

      <h2>4. Subscription Plans</h2>
      <p>
        The Service offers Free, Pro, and Team plans. Paid plans are billed monthly.
        You may upgrade or downgrade at any time. Downgrades take effect at the end
        of the current billing period.
      </p>

      <h2>5. Usage Limits</h2>
      <p>
        Each plan includes a monthly event limit. If you exceed your plan&apos;s limit,
        new events will be rejected (HTTP 429) until the next billing cycle or
        until you upgrade your plan.
      </p>

      <h2>6. Payment</h2>
      <p>
        Payments are processed by Dodo Payments as our Merchant of Record. By subscribing
        to a paid plan, you authorize recurring monthly charges. All prices are in USD.
        Dodo Payments handles tax calculation and remittance.
      </p>

      <h2>7. Cancellation and Refunds</h2>
      <p>
        You may cancel your subscription at any time through the billing portal.
        Upon cancellation, your account will revert to the Free plan at the end
        of the current billing period. We do not provide prorated refunds for
        partial months.
      </p>

      <h2>8. Data and Privacy</h2>
      <p>
        Your use of the Service is also governed by our{' '}
        <a href="/privacy">Privacy Policy</a>. We process telemetry data
        (token counts, model names, costs) that you send to our API. We do not
        store the content of your AI conversations.
      </p>

      <h2>9. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose</li>
        <li>Attempt to gain unauthorized access to the Service or its systems</li>
        <li>Interfere with or disrupt the Service</li>
        <li>Resell the Service without authorization</li>
        <li>Exceed rate limits or abuse the API</li>
      </ul>

      <h2>10. Intellectual Property</h2>
      <p>
        The NeuraMeter SDK and core packages are open source under the MIT License.
        The Service (dashboard, API, infrastructure) remains the property of NEURIA Inc.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE COMPANY SHALL NOT BE LIABLE FOR
        ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
        ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
        OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS
        PRECEDING THE CLAIM.
      </p>

      <h2>12. Disclaimer of Warranties</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS
        FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
      </p>

      <h2>13. Changes to Terms</h2>
      <p>
        We may modify these Terms at any time. We will notify you of material changes
        via email or through the Service. Continued use after changes constitutes
        acceptance.
      </p>

      <h2>14. Governing Law</h2>
      <p>
        These Terms are governed by the laws of Japan. Any disputes shall be subject
        to the exclusive jurisdiction of the Osaka District Court.
      </p>

      <h2>15. Contact</h2>
      <p>
        For questions about these Terms, contact us at{' '}
        <a href="mailto:support@neuria.tech">support@neuria.tech</a>.
      </p>
    </LegalLayout>
  );
}
