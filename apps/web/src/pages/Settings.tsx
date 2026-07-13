import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { BusinessSettings } from "../lib/types";
import { useToast } from "../components/Toast";

export function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => { void api<BusinessSettings>("/api/settings").then(setSettings); }, []);
  async function save() {
    if (!settings) return;
    const updated = await api<BusinessSettings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) });
    setSettings(updated);
    toast({ type: "success", message: "Business settings saved." });
  }
  async function testSms() {
    await api("/api/settings/test-sms", { method: "POST", body: JSON.stringify({ phone: testPhone, message: `${settings?.businessName ?? "POS"} test SMS` }) });
    toast({ type: "success", message: "Test SMS processed. Check logs for final status." });
  }
  if (!settings) return <section className="page"><div className="empty-state">Loading settings...</div></section>;
  return (
    <section className="page">
      <div className="page-head"><div><h1>Admin Settings</h1><span className="muted">Business profile and SMS configuration.</span></div><button className="primary" onClick={save}>Save settings</button></div>
      <div className="settings-grid">
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
          <label className="check"><input type="checkbox" checked={settings.smsEnabled} onChange={(e) => setSettings({ ...settings, smsEnabled: e.target.checked })} /> SMS enabled</label>
          <label className="check"><input type="checkbox" checked={settings.invoiceSmsAutoSend} onChange={(e) => setSettings({ ...settings, invoiceSmsAutoSend: e.target.checked })} /> Auto-send invoice SMS</label>
          <label className="check"><input type="checkbox" checked={settings.desiredItemSmsAutoSend} onChange={(e) => setSettings({ ...settings, desiredItemSmsAutoSend: e.target.checked })} /> Auto-send desired item SMS</label>
          <label className="check"><input type="checkbox" checked={settings.requireApprovalBeforeDesiredItemSms} onChange={(e) => setSettings({ ...settings, requireApprovalBeforeDesiredItemSms: e.target.checked })} /> Require approval before desired item SMS</label>
          <input value={settings.smsSenderId ?? ""} onChange={(e) => setSettings({ ...settings, smsSenderId: e.target.value })} placeholder="Sender ID display only" />
          <div className="safe-secret">Text.lk API token: {settings.textlkApiTokenStatus ?? "not_configured"}</div>
          <div className="inline-form"><input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="947XXXXXXXX" /><button onClick={testSms}>Test SMS</button></div>
          <div className="muted">SMS balance: Not available for this provider adapter.</div>
        </div>
      </div>
    </section>
  );
}
