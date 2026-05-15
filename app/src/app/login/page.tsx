// app/src/app/login/page.tsx
import LoginForm from '@/components/auth/LoginForm'
import styles from './login.module.css'

export default function LoginPage() {
  return (
    <div className={styles.shell}>
      <div className={styles.card}>

        <div className={styles.logoArea}>
          <div className={styles.logoMark}>Fluxtic <em>Salud</em></div>
          <div className={styles.logoTag}>CRM Clínico</div>
        </div>

        <div className={styles.divider} />

        <LoginForm />

      </div>
    </div>
  )
}
