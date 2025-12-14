import "../styles/policy.css";

export default function TermsConditions() {
  return (
    <div className="page-wrapper">
      <div className="policy-card">
        <h1 className="policy-title">Stamp Card Terms & Conditions</h1>

        <div className="stamp-box">
          <ul>
            <li>Spend ₹1000 → Earn 1 Stamp</li>
            <li>Complete 11 Stamps → We Gift You the 12th</li>
            <li>On 12th Stamp → ₹2000 Food Reward</li>
            <li>Scan & Collect — No App, No Login</li>
            <li>Birthday = Bonus Treat 🎂</li>
          </ul>
        </div>

        <ul className="policy-text">
          <li>Stamp cards are valid only at CakeRoven outlets.</li>
          <li>Stamps cannot be transferred or exchanged.</li>
          <li>No cash or refund alternative for rewards.</li>
          <li>Lost or expired stamps will not be reissued.</li>
          <li>Management reserves the right to update rules anytime.</li>
        </ul>
      </div>
    </div>
  );
}
