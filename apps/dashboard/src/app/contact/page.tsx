import { LegalLayout } from '@/components/legal-layout';

export const metadata = {
  title: 'Contact | NeuraMeter',
};

export default function ContactPage() {
  return (
    <LegalLayout title="Contact">
      <p>
        We&apos;d love to hear from you. Whether you have a question, feedback,
        or need support, here&apos;s how to reach us.
      </p>

      <h2>Email Support</h2>
      <p>
        For general inquiries and support:{' '}
        <a href="mailto:support@neuria.tech">support@neuria.tech</a>
      </p>
      <p>We aim to respond within 1 business day.</p>

      <h2>GitHub</h2>
      <p>
        For bug reports, feature requests, and open source contributions:{' '}
        <a
          href="https://github.com/kosukeuemura0220-del/neurameter"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/kosukeuemura0220-del/neurameter
        </a>
      </p>

      <h2>Social</h2>
      <p>
        Follow us on X (Twitter):{' '}
        <a
          href="https://x.com/kosukeuemura_"
          target="_blank"
          rel="noopener noreferrer"
        >
          @kosukeuemura_
        </a>
      </p>

      <h2>Company Information</h2>
      <table>
        <tbody>
          <tr>
            <th>Company</th>
            <td>NEURIA Inc.</td>
          </tr>
          <tr>
            <th>Location</th>
            <td>2-2 Umeda 1-chome, Kita-ku, Osaka 530-0001, Japan<br />(Osaka Ekimae Dai-2 Building 12-12)</td>
          </tr>
          <tr>
            <th>Website</th>
            <td>
              <a href="https://neuria.tech" target="_blank" rel="noopener noreferrer">
                neuria.tech
              </a>
            </td>
          </tr>
          <tr>
            <th>Email</th>
            <td>
              <a href="mailto:support@neuria.tech">support@neuria.tech</a>
            </td>
          </tr>
        </tbody>
      </table>
    </LegalLayout>
  );
}
