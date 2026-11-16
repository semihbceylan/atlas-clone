"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, Banknote, Building2, History, Keyboard, Sun, EyeOff, LogOut, MessageSquare, ChevronRight, ArrowLeft } from "lucide-react";
import { SideDrawer } from "./side-drawer";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setPreference, toggleModule } from "@/store/slices/terminal-slice";

type Screen = "menu" | "deposit" | "transfer" | "exchange" | "feedback" | "logout";
const rowClass = "flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-3 text-left text-[13px] hover:bg-terminal-hover disabled:opacity-40";
export function UserMenu({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(state => state.terminal.preferences);
  const modules = useAppSelector(state => state.terminal.visibleModules);
  const [screen, setScreen] = useState<Screen>("menu");
  const [feedback, setFeedback] = useState("");
  const [saved, setSaved] = useState(false);
  const titles: Record<Screen, string> = { menu: "Menü", deposit: "Midas'a para aktar", transfer: "Hesaplar arası transfer", exchange: "Döviz al/sat", feedback: "Geri bildirim ver", logout: "Çıkış yap" };
  return <SideDrawer title={titles[screen]} onClose={onClose} closeLabel="Kullanıcı menüsünü kapat" back={screen !== "menu" ? <button aria-label="Menüye dön" onClick={() => setScreen("menu")} className="rounded p-1 hover:bg-terminal-hover"><ArrowLeft className="size-4"/></button> : null} footer={<button onClick={() => setScreen("feedback")} className="flex w-full items-center justify-center gap-2 rounded border border-terminal-border py-2 text-xs hover:bg-terminal-hover"><MessageSquare className="size-4"/>Geri bildirim ver</button>}>
        {screen === "menu" ? <>
          <button className={rowClass} onClick={() => setScreen("deposit")}><ArrowDownToLine className="size-4"/>Midas&apos;a para aktar<ChevronRight className="ml-auto size-4 text-terminal-muted"/></button>
          <button className={rowClass} onClick={() => setScreen("transfer")}><ArrowLeftRight className="size-4"/>Hesaplar arası transfer<ChevronRight className="ml-auto size-4 text-terminal-muted"/></button>
          <button className={rowClass} onClick={() => setScreen("exchange")}><Banknote className="size-4"/>Döviz al/sat<span className="ml-auto rounded bg-terminal-accent/15 px-2 py-0.5 text-[10px] text-terminal-accent-soft">Yeni</span><ChevronRight className="size-4 text-terminal-muted"/></button>
          <button disabled className={rowClass}><Building2 className="size-4"/>Bankaya para çek<span className="ml-auto text-[10px]">Yakında</span></button>
          <button className={rowClass} onClick={() => { if (!modules.includes("orders")) dispatch(toggleModule("orders")); onClose(); requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-widget-id="orders"] section')?.focus()); }}><History className="size-4"/>İşlem geçmişi<ChevronRight className="ml-auto size-4 text-terminal-muted"/></button>
          <button disabled className={rowClass}><Keyboard className="size-4"/>Klavye kısayolları<span className="ml-auto text-[10px]">Yakında</span></button>
          <div className="my-3 border-t border-terminal-border"/>
          <PreferenceSwitch label="Açık temayı kullan" checked={preferences.lightTheme} icon={<Sun className="size-4"/>} onChange={value => dispatch(setPreference({ key: "lightTheme", value }))}/>
          <PreferenceSwitch label="Bakiye ve tutarları gizle" checked={preferences.hideAmounts} icon={<EyeOff className="size-4"/>} onChange={value => dispatch(setPreference({ key: "hideAmounts", value }))}/>
          <div className="my-3 border-t border-terminal-border"/>
          <button className={`${rowClass} text-terminal-down`} onClick={() => setScreen("logout")}><LogOut className="size-4"/>Çıkış yap</button>
        </> : screen === "feedback" ? <form onSubmit={e => { e.preventDefault(); const url = URL.createObjectURL(new Blob([feedback], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "terminal-lab-feedback.txt"; link.click(); URL.revokeObjectURL(url); setSaved(true); }} className="space-y-4 text-xs"><p className="text-terminal-muted">Geri bildirimin Midas&apos;a veya başka bir sunucuya gönderilmez. Metni dosya olarak indirebilirsin.</p><textarea required aria-label="Geri bildirim" maxLength={5000} value={feedback} onChange={e => { setFeedback(e.target.value); setSaved(false); }} className="h-40 w-full rounded border border-terminal-border bg-terminal-bg p-3"/><button className="rounded bg-terminal-accent px-3 py-2 text-white">Geri bildirimi indir</button>{saved ? <p role="status">Geri bildirim dosyası hazırlandı.</p> : null}</form> : <div className="space-y-4 rounded border border-terminal-border p-4 text-sm"><span className="inline-block rounded bg-terminal-accent/15 px-2 py-1 text-[10px] text-terminal-accent-soft">Bağımsız demo</span><p>{screen === "logout" ? "Bu uygulamada oturum açma veya gerçek hesap bağlantısı yok. Çıkış yapılacak bir Midas oturumu bulunmuyor." : screen === "deposit" ? "Bu demo gerçek para kabul etmez. Banka bilgisi veya IBAN gösterilmez ve para transferi başlatılmaz." : screen === "transfer" ? "Gerçek yatırım veya kripto hesapları bağlı değil. Hesaplar arası para transferi bu demoda kullanılamaz." : "Döviz sağlayıcısı ve gerçek hesap bağlı değil. Bu ekrandan döviz emri gönderilmez ve kur teklifi üretilmez."}</p><p className="text-xs text-terminal-muted">Gerçek hesap işlemleri için resmi Midas uygulamasını kullan. Bu proje Midas ile bağlantılı değildir.</p><button onClick={() => setScreen("menu")} className="rounded border border-terminal-border px-3 py-2">Menüye dön</button></div>}
  </SideDrawer>;
}
function PreferenceSwitch({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (value: boolean) => void; icon: React.ReactNode }) {
  return <button role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={rowClass}>{icon}<span className="flex-1">{label}</span><span className={`flex h-5 w-9 items-center rounded-full p-0.5 ${checked ? "bg-terminal-accent" : "bg-terminal-border-strong"}`}><span className={`size-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}/></span></button>;
}
