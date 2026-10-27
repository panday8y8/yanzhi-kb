import { SettingsView } from '../../components/SettingsView'
import { getSettingsData } from '../../lib/workspace'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const data = getSettingsData()
  return (
    <main className="page">
      <section style={{ padding: '4px 2px 18px' }}>
        <div className="hero-kicker">
          <span className="kicker">Settings</span>
          <span className="tag">服务端凭证 · 浏览器不可见</span>
        </div>
        <h1 className="hero-title" style={{ fontSize: 32 }}>
          系统设置
        </h1>
        <p className="hero-sub" style={{ marginTop: 8 }}>
          模型、生成参数与知识库存储都在这里管理。凭证只从服务端环境变量读取，前端只拿到脱敏后的状态。
        </p>
      </section>

      <SettingsView
        config={{
          provider: data.config.provider,
          configured: data.config.configured,
          baseUrl: data.config.baseUrl,
          model: data.config.model,
          credentialSource: data.config.credentialSource,
          credentialLabel: data.config.credentialLabel,
          models: data.config.models,
        }}
        counts={data.counts}
        compiledAt={data.compiledAt}
      />
    </main>
  )
}
