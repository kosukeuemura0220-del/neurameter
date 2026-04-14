import { LegalLayout } from '@/components/legal-layout';

export const metadata = {
  title: 'Privacy Policy | NeuraMeter',
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>Last updated: April 2026</p>

      <h2>1. Introduction</h2>
      <p>
        NEURIA Inc. (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;) operates NeuraMeter, an AI cost monitoring
        and context engineering platform. This Privacy Policy explains how we collect,
        use, and protect your information.
      </p>

      <h2>2. Information We Collect</h2>

      <h3>2.1 Account Information</h3>
      <p>
        When you create an account, we collect your email address and authentication
        credentials (managed via Supabase Auth).
      </p>

      <h3>2.2 Telemetry Data</h3>
      <p>
        When you use the NeuraMeter SDK or API, we receive telemetry data including:
      </p>
      <ul>
        <li>AI model names and providers</li>
        <li>Token counts (input, output, cached, reasoning)</li>
        <li>Cost calculations (in microdollars)</li>
        <li>Latency measurements</li>
        <li>Agent names, task names, and customer IDs you assign</li>
        <li>Context utilization metrics</li>
        <li>Guard decisions and triggered rules</li>
      </ul>
      <p>
        <strong>We do NOT collect or store the content of your AI conversations,
        prompts, or completions.</strong>
      </p>

      <h3>2.3 Billing Information</h3>
      <p>
        Payment information is collected and processed by Dodo Payments (our Merchant
        of Record). We store your Dodo customer ID and subscription ID but do not
        store credit card numbers or payment details.
      </p>

      <h3>2.4 Usage Data</h3>
      <p>
        We collect standard web analytics data such as IP addresses, browser type,
        and pages visited to improve the Service.
      </p>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To provide and maintain the Service</li>
        <li>To display cost analytics and optimization recommendations</li>
        <li>To enforce usage limits based on your subscription plan</li>
        <li>To process payments and manage subscriptions</li>
        <li>To send important service-related notifications</li>
        <li>To improve the Service and develop new features</li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        Telemetry data retention depends on your plan: Free (7 days), Pro (30 days),
        Team (90 days). Account data is retained until you delete your account.
      </p>

      <h2>5. Data Sharing</h2>
      <p>We do not sell your personal information. We share data only with:</p>
      <ul>
        <li><strong>Dodo Payments</strong> — payment processing (as Merchant of Record)</li>
        <li><strong>Supabase</strong> — database and authentication infrastructure</li>
        <li><strong>Cloudflare</strong> — API hosting and CDN</li>
        <li><strong>Vercel</strong> — dashboard hosting</li>
      </ul>

      <h2>6. Data Security</h2>
      <p>
        We implement industry-standard security measures including encrypted
        connections (TLS), hashed API keys, and access controls. However, no
        method of transmission over the Internet is 100% secure.
      </p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Correct inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Export your data</li>
        <li>Withdraw consent for data processing</li>
      </ul>
      <p>
        To exercise these rights, contact us at{' '}
        <a href="mailto:support@neuria.tech">support@neuria.tech</a>.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use essential cookies for authentication and session management.
        We do not use third-party tracking cookies.
      </p>

      <h2>9. International Data Transfers</h2>
      <p>
        Your data may be processed in countries outside your country of residence,
        including the United States and Japan. We ensure appropriate safeguards
        are in place for such transfers.
      </p>

      <h2>10. Children&apos;s Privacy</h2>
      <p>
        The Service is not directed to children under 16. We do not knowingly
        collect personal information from children.
      </p>

      <h2>11. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of material changes via email or through the Service.
      </p>

      <h2>12. Contact</h2>
      <p>
        For privacy-related inquiries, contact us at{' '}
        <a href="mailto:support@neuria.tech">support@neuria.tech</a>.
      </p>
      <p>
        NEURIA Inc.<br />
        2-2 Umeda 1-chome, Kita-ku, Osaka 530-0001, Japan
      </p>
    </LegalLayout>
  );
}
