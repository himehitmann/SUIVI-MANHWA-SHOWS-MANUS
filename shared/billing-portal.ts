/** Only a shareable Stripe portal login link, never a customer session URL. */
export function stripePortalLoginUrl(value: unknown): string | null {
  if (typeof value !== "string" || value !== value.trim() || !/^https:\/\/billing\.stripe\.com\/p\/login\/(?:test_)?[A-Za-z0-9]{8,128}$/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "billing.stripe.com" &&
      !url.username && !url.password && !url.port && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}
const COPY = {
  en: {title:"Billing",label:"Manage billing or cancel",help:"Stripe verifies the email used for payment, which may differ from your Yomu email. Available actions depend on the seller’s portal settings.",unavailable:"Billing management is not configured for this service yet.",error:"Billing management could not be loaded.",retry:"Try again",loading:"Loading billing access…",deletion:"Deleting your Yomu account does not cancel a subscription. Manage any active subscription before deleting your account."},
  fr: {title:"Facturation",label:"Gérer ou résilier l’abonnement",help:"Stripe vérifie l’adresse e-mail utilisée pour le paiement, qui peut différer de celle de Yomu. Les actions disponibles dépendent des réglages du portail du vendeur.",unavailable:"La gestion de la facturation n’est pas encore configurée pour ce service.",error:"Impossible de charger l’accès à la facturation.",retry:"Réessayer",loading:"Chargement de l’accès à la facturation…",deletion:"Supprimer ton compte Yomu ne résilie pas un abonnement. Gère tout abonnement actif avant de supprimer ton compte."},
  es: {title:"Facturación",label:"Gestionar o cancelar la suscripción",help:"Stripe verifica el correo usado para pagar, que puede ser diferente al de Yomu. Las acciones disponibles dependen de la configuración del portal del vendedor.",unavailable:"La gestión de facturación aún no está configurada para este servicio.",error:"No se pudo cargar el acceso a facturación.",retry:"Reintentar",loading:"Cargando acceso a facturación…",deletion:"Eliminar tu cuenta de Yomu no cancela una suscripción. Gestiona cualquier suscripción activa antes de eliminar tu cuenta."},
  de: {title:"Abrechnung",label:"Abo verwalten oder kündigen",help:"Stripe prüft die bei der Zahlung verwendete E-Mail-Adresse. Sie kann von deiner Yomu-Adresse abweichen. Verfügbare Aktionen hängen von den Portaleinstellungen des Anbieters ab.",unavailable:"Die Abrechnungsverwaltung ist für diesen Dienst noch nicht eingerichtet.",error:"Der Zugang zur Abrechnung konnte nicht geladen werden.",retry:"Erneut versuchen",loading:"Zugang zur Abrechnung wird geladen…",deletion:"Das Löschen deines Yomu-Kontos kündigt kein Abonnement. Verwalte aktive Abonnements, bevor du dein Konto löschst."},
  pt: {title:"Faturação",label:"Gerir ou cancelar a assinatura",help:"O Stripe verifica o email usado no pagamento, que pode ser diferente do email do Yomu. As ações disponíveis dependem das definições do portal do vendedor.",unavailable:"A gestão de faturação ainda não está configurada para este serviço.",error:"Não foi possível carregar o acesso à faturação.",retry:"Tentar novamente",loading:"A carregar o acesso à faturação…",deletion:"Eliminar a conta Yomu não cancela uma assinatura. Gere qualquer assinatura ativa antes de eliminar a conta."},
  ja: {title:"お支払い",label:"契約の管理・解約",help:"Stripeが決済時のメールアドレスを確認します。Yomuのメールアドレスとは異なる場合があります。利用できる操作は販売者のポータル設定によって異なります。",unavailable:"このサービスでは請求管理がまだ設定されていません。",error:"請求管理へのアクセスを読み込めませんでした。",retry:"再試行",loading:"請求管理へのアクセスを読み込み中…",deletion:"Yomuアカウントを削除しても契約は解約されません。削除前に有効な契約を管理してください。"},
  ko: {title:"결제 관리",label:"구독 관리 또는 해지",help:"Stripe에서 결제에 사용한 이메일을 확인합니다. Yomu 이메일과 다를 수 있습니다. 가능한 작업은 판매자의 포털 설정에 따라 달라집니다.",unavailable:"이 서비스의 결제 관리가 아직 설정되지 않았습니다.",error:"결제 관리 접근 정보를 불러오지 못했습니다.",retry:"다시 시도",loading:"결제 관리 접근 정보 로딩 중…",deletion:"Yomu 계정을 삭제해도 구독은 해지되지 않습니다. 계정을 삭제하기 전에 활성 구독을 관리하세요."},
  "zh-CN": {title:"账单",label:"管理或取消订阅",help:"Stripe将验证付款时使用的邮箱，可能与Yomu邮箱不同。可用操作取决于卖家的门户设置。",unavailable:"此服务尚未配置账单管理。",error:"无法加载账单管理入口。",retry:"重试",loading:"正在加载账单管理入口…",deletion:"删除Yomu账户不会取消订阅。请在删除账户前管理所有有效订阅。"}
};
export function billingPortalCopy(lang: string) { return COPY[lang as keyof typeof COPY] || COPY.en; }

/** Shared extension UI; no tokens, emails or billing sessions are rendered. */
const mounts = new WeakMap<HTMLElement, object>();
export function mountBillingPortal(
  element: HTMLElement, lang: string,
  request: () => Promise<{ok?: boolean; url?: unknown; error?: string}>,
  isCurrent: () => boolean = () => true
) {
  const marker = {}, copy = billingPortalCopy(lang);
  mounts.set(element, marker);
  const active = () => element.isConnected && mounts.get(element) === marker && isCurrent();
  const message = document.createElement("p");
  message.setAttribute("role", "status"); message.setAttribute("aria-live", "polite");
  const help = document.createElement("p"); help.textContent = copy.help;
  element.replaceChildren(message, help);
  const load = async () => {
    message.textContent = copy.loading;
    for (const control of element.querySelectorAll("a,button")) control.remove();
    try {
      const response = await request();
      if (!active()) return;
      if (!response?.ok) throw new Error(response?.error || "billing_portal_failed");
      const url = stripePortalLoginUrl(response.url);
      if (!url) throw new Error("billing_portal_failed");
      message.textContent = "";
      const link = document.createElement("a");
      link.href = url; link.target = "_blank"; link.rel = "noopener noreferrer";
      link.className = "billing-portal-link"; link.textContent = copy.label;
      element.insertBefore(link, help);
    } catch (error) {
      if (!active()) return;
      const unavailable = error instanceof Error && error.message === "billing_portal_unavailable";
      message.textContent = unavailable ? copy.unavailable : copy.error;
      if (!unavailable) {
        const retry = document.createElement("button");
        retry.type = "button"; retry.textContent = copy.retry; retry.onclick = () => { void load(); };
        element.insertBefore(retry, help);
      }
    }
  };
  void load();
  return () => { if (mounts.get(element) === marker) { mounts.delete(element); element.replaceChildren(); } };
}
