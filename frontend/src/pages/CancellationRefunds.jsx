import "../styles/policy.css";

export default function CancellationRefunds() {
  return (
    <div className="page-wrapper">
      <div className="policy-card">
        <h1 className="policy-title">Cancellation & Refund Policy</h1>

        <p className="policy-text">
          At <strong>CakeRoven</strong>, all payments and stamp-related
          transactions are final.
        </p>

        <div className="stamp-box center">
          ❌ NO CANCELLATIONS <br />
          ❌ NO REFUNDS <br />
          ❌ NO REVERSALS
        </div>

        <p className="policy-text">
          Once a payment is successfully completed via Razorpay or any other
          mode, it cannot be cancelled, refunded, or transferred.
        </p>

        <p className="policy-text">
          Stamp cards, food rewards, and promotional offers are strictly
          non-refundable and non-exchangeable.
        </p>
      </div>
    </div>
  );
}
