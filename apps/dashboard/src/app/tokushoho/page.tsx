import { LegalLayout } from '@/components/legal-layout';

export const metadata = {
  title: '特定商取引法に基づく表記 | NeuraMeter',
};

export default function TokushohoPage() {
  return (
    <LegalLayout title="特定商取引法に基づく表記">
      <table>
        <tbody>
          <tr>
            <th>販売業者</th>
            <td>NEURIA Inc.</td>
          </tr>
          <tr>
            <th>代表者</th>
            <td>上村 康輔</td>
          </tr>
          <tr>
            <th>所在地</th>
            <td>〒530-0001 大阪府大阪市北区梅田1丁目2番2号 大阪駅前第2ビル 12-12</td>
          </tr>
          <tr>
            <th>電話番号</th>
            <td>お問い合わせいただければ遅滞なく開示いたします</td>
          </tr>
          <tr>
            <th>メールアドレス</th>
            <td>
              <a href="mailto:support@neuria.tech">support@neuria.tech</a>
            </td>
          </tr>
          <tr>
            <th>URL</th>
            <td>
              <a href="https://meter.neuria.tech">https://meter.neuria.tech</a>
            </td>
          </tr>
          <tr>
            <th>商品の名称</th>
            <td>NeuraMeter（AI コスト監視・コンテキストエンジニアリングプラットフォーム）</td>
          </tr>
          <tr>
            <th>販売価格</th>
            <td>
              Free: $0/月、Pro: $29/月（年払い $276/年）、Team: $79/月（年払い $756/年）（米ドル建て）
              <br />
              ※ 全有料プランに14日間の無料トライアルあり
              <br />
              ※ Dodo Payments が Merchant of Record として税金の計算・徴収を行います
            </td>
          </tr>
          <tr>
            <th>商品代金以外の必要料金</th>
            <td>なし</td>
          </tr>
          <tr>
            <th>支払方法</th>
            <td>クレジットカード、デビットカード（Dodo Payments 経由）</td>
          </tr>
          <tr>
            <th>支払時期</th>
            <td>14日間の無料トライアル終了後に初回課金、以降は毎月（または毎年）の更新日に自動課金</td>
          </tr>
          <tr>
            <th>商品の引渡し時期</th>
            <td>お支払い確認後、即時にサービスをご利用いただけます</td>
          </tr>
          <tr>
            <th>返品・キャンセル</th>
            <td>
              いつでもキャンセル可能です。無料トライアル期間中のキャンセルは課金されません。キャンセル後は現在の請求期間の終了までサービスをご利用いただけます。日割り返金は行っておりません。
            </td>
          </tr>
          <tr>
            <th>動作環境</th>
            <td>
              モダンなウェブブラウザ（Chrome、Firefox、Safari、Edge の最新版）。
              SDK は Node.js 18 以上で動作します。
            </td>
          </tr>
        </tbody>
      </table>
    </LegalLayout>
  );
}
