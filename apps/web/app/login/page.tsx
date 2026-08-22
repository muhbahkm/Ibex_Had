import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="shell login-wrap">
      <section className="card login-card">
        <div className="topbar">
          <div className="brand"><span className="brand-mark">IH</span><span>IBEX HAD</span></div>
          <span className="badge">Merchant Web</span>
        </div>
        <div className="login-head">
          <h1>دخول آمن برقم الجوال</h1>
          <p>نفس هوية IBEX HAD على الهاتف: الاسم ورقم الجوال ثم رمز OTP. لا يوجد اسم مستخدم أو كلمة مرور منفصلة.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
