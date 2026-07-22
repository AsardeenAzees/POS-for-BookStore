import { useEffect, useState } from "react";
import { ApiError, api, getSession } from "../lib/api";
import type { BusinessSettings } from "../lib/types";
import { useToast } from "../components/Toast";
import { PagePreloader } from "../components/Preloader";

export function Settings() {
  const toast = useToast();
  const isAdmin = getSession()?.user.role === "ADMIN";
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("POS SMS API test successful.");
  const [testingSms, setTestingSms] = useState(false);
  const [testResult, setTestResult] = useState<SmsTestResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => { void api<BusinessSettings>("/api/settings").then(setSettings).catch((err) => setError(err instanceof Error ? err.message : "Unable to load settings")); }, []);
  async function save() {
    if (!settings) return;
    if (settings.smsProvider === "textlk" && settings.smsEnabled && !settings.smsSenderId?.trim()) {
      toast({ type: "error", message: "Text.lk requires an approved Sender ID before sending SMS." });
      return;
    }
    try {
      const updated = await api<BusinessSettings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
      setSettings(updated);
      toast({ type: "success", message: "Business settings saved." });
    } catch (err) {
      toast({ type: "error", message: err instanceof Error ? err.message : "Unable to save settings" });
    }
  }
  async function testSms() {
    if (settings?.smsProvider === "textlk" && !settings.smsSenderId?.trim()) {
      toast({ type: "error", message: "Enter and save your approved Text.lk Sender ID first." });
      return;
    }
    if (testingSms) return;
    setTestingSms(true);
    setTestResult(null);
    try {
      const result = await api<SmsTestResult>("/api/settings/test-sms", { method: "POST", body: JSON.stringify({ phone: testPhone, message: testMessage.trim() || undefined, provider: settings?.smsProvider }) });
      setTestResult(result);
      const smsStatus = result.smsStatus ?? result.status.toLowerCase();
      const message = smsStatus === "dry_run"
        ? `${result.provider} dry-run recorded. No real SMS was sent.`
        : `${result.provider} SMS sent successfully${result.rawStatus ? ` (${result.rawStatus})` : ""}.`;
      toast({ type: "success", message });
    } catch (error) {
      if (error instanceof ApiError && error.data) setTestResult(error.data as SmsTestResult);
      toast({ type: "error", message: error instanceof Error ? error.message : "Test SMS failed" });
    } finally {
      setTestingSms(false);
    }
  }
  if (error) return <section className="page"><div className="alert">{error}</div></section>;
  if (!settings) return <PagePreloader />;
  return (
    <section className="page">
      <div className="page-head"><div><h1>Business Settings</h1><span className="muted">{isAdmin ? "Business profile and SMS configuration." : "Read-only settings. Only administrators can make changes."}</span></div>{isAdmin && <button className="primary" onClick={save}>Save settings</button>}</div>
      <fieldset disabled={!isAdmin} className="settings-grid settings-fieldset">
        <div className="panel form-stack">
          <h2>Business Profile</h2>
          <input value={settings.businessName} onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} placeholder="Business name" />
          <input value={settings.address ?? ""} onChange={(e) => setSettings({ ...settings, address: e.target.value })} placeholder="Address" />
          <input value={settings.phone ?? ""} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} placeholder="Phone" />
          <input value={settings.email ?? ""} onChange={(e) => setSettings({ ...settings, email: e.target.value })} placeholder="Email" />
          <input value={settings.taxRegistration ?? ""} onChange={(e) => setSettings({ ...settings, taxRegistration: e.target.value })} placeholder="Tax/registration optional" />
          <input value={settings.receiptFooterText} onChange={(e) => setSettings({ ...settings, receiptFooterText: e.target.value })} placeholder="Receipt footer" />
        </div>
        <div className="panel form-stack">
          <h2>SMS Settings</h2>
          <label>Provider<select value={settings.smsProvider} onChange={(e) => setSettings({ ...settings, smsProvider: e.target.value as "mock" | "textlk" })}><option value="mock">Mock</option><option value="textlk">Text.lk</option></select></label>
          {settings.smsProvider === "mock" && <div className="warning">Mock mode is only a local test. It records a dry-run and will not deliver SMS to a phone.</div>}
          {settings.smsProvider === "textlk" && settings.textlkDryRun && <div className="warning">Text.lk dry-run is enabled on the API server. No SMS will be delivered until TEXTLK_DRY_RUN=false and the API is restarted.</div>}
          {settings.smsProvider === "textlk" && !settings.textlkDryRun && <div className="safe-secret">Text.lk live mode is active. Test and invoice SMS actions can send a real message and use SMS credit.</div>}
          <label className="check"><input type="checkbox" checked={settings.smsEnabled} onChange={(e) => setSettings({ ...settings, smsEnabled: e.target.checked })} /> SMS enabled</label>
          <label className="check"><input type="checkbox" checked={settings.invoiceSmsAutoSend} onChange={(e) => setSettings({ ...settings, invoiceSmsAutoSend: e.target.checked })} /> Auto-send invoice SMS</label>
          <input value={settings.smsSenderId ?? ""} onChange={(e) => setSettings({ ...settings, smsSenderId: e.target.value })} placeholder="Approved Text.lk Sender ID" />
          {settings.smsProvider === "textlk" && !settings.smsSenderId?.trim() && <div className="warning">Text.lk requires an approved Sender ID. Add it here, click Save settings, then test SMS.</div>}
          <div className="safe-secret">Text.lk API token: {settings.textlkApiTokenStatus ?? "not_configured"}</div>
          <label>Test recipient<input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="0758396064 or 94758396064" /></label>
          <label>Test message<textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} placeholder="POS SMS API test successful." rows={3} /></label>
          <button type="button" onClick={testSms} disabled={testingSms || !testPhone.trim()}>{testingSms ? "Sending..." : smsTestButtonLabel(settings)}</button>
          {testResult && <div className={testResult.status === "FAILED" || testResult.status === "SKIPPED" ? "alert" : "safe-secret"} role="status">
            <strong>{testResult.status === "FAILED" || testResult.status === "SKIPPED" ? "SMS test failed" : "SMS test completed"}</strong>
            <div>Provider: {testResult.provider}</div>
            <div>Status: {testResult.smsStatus ?? testResult.status.toLowerCase()}</div>
            {testResult.providerMessageId && <div>Provider message ID: {testResult.providerMessageId}</div>}
            {testResult.rawStatus && <div>Delivery status: {testResult.rawStatus}</div>}
            {testResult.errorMessage && <div>{testResult.errorMessage}</div>}
          </div>}
          <div className="muted">Text.lk request format: recipient, sender_id, type, message.</div>
        </div>
      </fieldset>
    </section>
  );
}

type SmsTestResult = {
  provider: string;
  status: string;
  smsStatus?: string;
  providerMessageId?: string;
  rawStatus?: string;
  errorMessage?: string;
};

function smsTestButtonLabel(settings: BusinessSettings) {
  if (settings.smsProvider === "mock") return "Record mock SMS test";
  return settings.textlkDryRun ? "Run Text.lk dry-run" : "Send real test SMS";
}
