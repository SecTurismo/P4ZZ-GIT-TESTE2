export interface Addon {
  id: string;
  name: string;
  totalQuantity: number;
  unit: string;
  linkedProducts: {
    productId: string;
    productName: string;
    usagePerSale: number;
  }[];
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  description: string;
  barcode?: string;
  active?: boolean;
  sortOrder?: number;
  icon?: string;
}

export interface Category {
  id: string;
  name: string;
  idRef?: string;
  active?: boolean;
  icon?: string;
  sortOrder?: number;
}

export interface Plan {
  id: string;
  name: string;
  days: number;
  price: number;
  renewalPrice?: number;
  description?: string;
  isPersonalized?: boolean;
  linkedDocument?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  cost: number;
  subtotal: number;
  observation?: string;
  isPrintedToKitchen?: boolean;
}

export interface Table {
  id: number;
  label: string;
  status: 'Livre' | 'Ocupada' | 'Aguardando Pagamento' | 'Reservada';
  items: SaleItem[];
  startTime?: string;
  notes?: string;
}

export interface Delivery {
  id: string;
  displayId?: number;
  customerName: string;
  phone?: string;
  address: string;
  reference?: string;
  items: SaleItem[];
  total: number;
  createdAt: string;
  status: 'pending' | 'out';
  deliveryStage?: 'active' | 'paused';
  changeFor?: number;
  paymentMethod?: 'Pix' | 'Dinheiro' | 'Cartão';
  sortOrder?: number;
  isPaid?: boolean;
  userId?: string; 
  userName?: string; 
}

export interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'Dinheiro' | 'Cartão' | 'Pix';
  status: 'Concluída' | 'Cancelada';
  preparationStatus?: 'pending' | 'preparing' | 'ready' | 'delivered';
  preparationStartTime?: string;
  preparationEndTime?: string;
  tableNumber?: number;
  tableLabel?: string;
  customerId?: string;
  isDelivery?: boolean;
  deliveryNumber?: number;
  deliveryInfo?: {
    customerName: string;
    phone?: string;
    address: string;
    reference?: string;
    changeFor?: number;
    paymentMethod?: string;
  };
  userId: string; 
  userName: string; 
}

export interface Supplier {
  id: string;
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  notes?: string;
  active: boolean;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  total: number;
  status: 'pending' | 'received' | 'cancelled';
  paymentStatus: 'pending' | 'paid';
  receivedAt?: string;
}

export interface Reservation {
  id: string;
  tableId: number;
  tableLabel: string;
  customerName: string;
  customerPhone: string;
  customerWhatsApp?: string;
  customerDocument?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  guests: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'seated' | 'no-show';
  notes?: string;
  createdAt: string;
}

export interface CashFlowEntry {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  referenceId?: string; // ID da venda ou despesa
}

export interface ConsumptionRecord {
  id: string;
  userId: string;
  userName: string;
  tenantId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;
}

export interface CashierShift {
  id: string;
  userId: string;
  tenantId: string;
  userName: string;
  openDate: string;
  closeDate?: string;
  initialCash: number;
  finalCash?: number;
  status: 'aberto' | 'fechado';
}

export interface CashierClosure {
  id: string;
  userId: string;
  userName: string;
  tenantId: string;
  date: string;
  systemPix: number;
  systemCard: number;
  systemCash: number;
  informedPix: number;
  informedCard: number;
  informedCash: number;
  totalSystem: number;
  totalInformed: number;
  difference: number;
  observations?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  document?: string;
  balance: number;
  status: 'active' | 'debtor' | 'blocked' | 'tolerance';
  createdAt: string;
  linkedUserId?: string;
  licenseExpiresAt: string;
  planName?: string;
}

export interface FiadoItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Fiado {
  id: string;
  customerName: string;
  items: FiadoItem[];
  total: number;
  date: string;
  status: 'Pendente' | 'Pago';
  userId: string;
  userName: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

export interface PixKey {
  id: string;
  type: string;
  key: string;
  label: string;
}

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  login: string;
  passwordHash: string;
  role: 'admin' | 'customer' | 'demo' | 'employee' | 'affiliate';
  active: boolean;
  cashierStatus?: 'Aberto' | 'Fechado';
  permissions?: View[]; 
  category?: string;
  photoUrl?: string;
  expiresAt?: string;
  planName?: string;
  paymentCycle?: number;
  deactivatedMessage?: string;
  document?: string;
  whatsapp?: string;
  gracePeriod?: number;
  paymentNotification?: 'approved' | 'rejected';
  adminResponseMessage?: string;
  paymentRejectionTime?: string;
  paymentPopupPending?: boolean;
  createdAt?: string; 
  approvedAt?: string;
  originIp?: string;
  originLocation?: string;
  createdManually?: boolean;
  skipCashierClosure?: boolean;
  isAffiliate?: boolean;
  affiliateId?: string;
  sellingPrice?: number;
  lastCommissionRequestDate?: string;
  isDemoViewer?: boolean;
  paymentType?: 'manual' | 'automatic';
  pixReceipt?: string;
  pixName?: string;
  pixKey?: string;
  pixKeys?: PixKey[];
  canAccessTables?: boolean;
}

export interface AccessRequest {
  id: string;
  name: string;
  document: string;
  whatsapp: string;
  email: string;
  login: string;
  category: string;
  plan?: string;
  passwordHash: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  originIp?: string;
  originLocation?: string;
  affiliateId?: string;
  sellingPrice?: number;
  pixReceipt?: string;
  paymentType?: 'manual' | 'automatic';
  adminMessage?: string;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  tenantId: string;
  userName: string;
  payerName: string;
  payerDocument?: string;
  paymentTime: string;
  receiptImage?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  mpPaymentId?: string;
  amount?: number;
  rejectionReason?: string;
  customerMessage?: string;
  adminMessage?: string;
}

export interface MenuCategory {
  id: string;
  label: string;
  items: View[];
}

export interface PrintLayoutConfig {
  header?: string;
  footer?: string;
  message?: string;
  paperSize: string;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  showItemsPrice?: boolean;
  showTotal?: boolean;
}

export interface PrintSettings {
  customerReceipt: PrintLayoutConfig;
  kitchenOrder: PrintLayoutConfig;
  a4Report: PrintLayoutConfig;
  autoPrint?: boolean;
  printDelay?: number;
}

export interface SocialLink {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'whatsapp';
  url: string;
}

export interface KDSOrder {
  id: string;
  orderNumber: string;
  type: 'table' | 'direct' | 'delivery';
  identifier: string; // Table label or Customer name
  items: SaleItem[];
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  createdAt: string;
  preparationStartTime?: string;
  preparationEndTime?: string;
  tableId?: number;
  saleId?: string;
}

export interface AppSettings {
  systemName: string;
  logoUrl?: string;
  faviconUrl?: string;
  logoOpacity?: number;
  primaryColor: string;
  accentColor: string;
  loginStyle: 'apple' | 'minimalist' | 'aurora' | 'enterprise';
  themeMode: 'light' | 'dark';
  sidebarTheme: 'dark' | 'light' | 'colored' | 'midnight' | 'carbon' | 'nebula' | 'ocean' | 'forest' | 'glacier' | 'aurora-anim' | 'neon-anim' | 'ocean-anim' | 'neb-anim' | 'mat-anim' | 'wav-anim' | 'sno-anim' | 'aur-anim' | 'ste-anim' | 'geo-anim' | 'cyb-anim' | 'fir-anim' | 'flu-anim' | 'xma-anim' | 'eas-anim' | 'jun-anim' | 'bra-anim' | 'nyr-anim' | 'hal-anim' | 'car-anim' | 'aut-anim' | 'spr-anim' | 'sum-anim';
  sidebarColor: string;
  sidebarActiveColor: string;
  sidebarWidth: number; 
  sidebarItemPadding: number; 
  sidebarFontSize: number;
  sidebarIconSize: number;
  sidebarActiveItemRadius: number;
  sidebarEffectOpacity: number;
  sidebarAnimated?: boolean;
  uiDensity: 'compact' | 'standard' | 'spacious';
  buttonStyle: 'rounded' | 'pill' | 'sharp';
  cardShadow: 'none' | 'soft' | 'hard';
  glassIntensity: number;
  loginTitle: string;
  loginWelcomeMessage: string;
  loginButtonText: string;
  loginBgColor: string;
  loginAnimColor: string;
  loginAnimSpeed: number;
  loginOrbDensity: number;
  loginShowGradient: boolean;
  loginSalesTitle?: string;
  loginSalesText?: string;
  loginFeatures?: string;
  loginBackgroundImage?: string;
  loginEffect?: 'none' | 'aurora' | 'particles' | 'matrix' | 'rain' | 'stars' | 'universe' | 'galaxy' | 'cosmos' | 'techno' | 'cyber' | 'neon';
  loginEffectColor?: string;
  loginBoxTop?: number;
  loginBoxLeft?: number;
  loginBoxScale?: number;
  loginBoxPosition?: 'left' | 'center' | 'right';
  loginMarketingTop?: number;
  loginMarketingLeft?: number;
  loginMarketingScale?: number;
  loginMarketingAlign?: 'left' | 'center' | 'right';
  loginMarketingFontSize?: number;
  loginMarketingTitleSize?: number;
  loginMarketingTitleOpacity?: number;
  loginMarketingFeatureFontSize?: number;
  loginMarketingFeatureIconSize?: number;
  loginMarketingFeatureGap?: number;
  loginMarketingFeaturePadding?: number;
  loginMarketingFeatureBorderRadius?: number;
  loginMarketingTitleLetterSpacing?: number;
  loginMarketingFeatureScale?: number;
  loginMarketingFeatureOpacity?: number;
  loginMarketingFeatureMoveX?: number;
  loginMarketingFeatureAnim?: 'none' | 'floating' | 'bounce' | 'pulse' | 'wave' | 'spin-slow' | 'shake' | 'zoom' | 'slide-side' | 'swing' | 'heartbeat' | 'rubber-band' | 'glitch' | 'rotate-y';
  loginMarketingFeatureAnimSpeed?: number;
  loginMarketingFeatureWidth?: number;
  loginMarketingFeaturesSideBySide?: boolean;
  loginBalloonColor?: string;
  loginBalloonHeight?: number;
  loginMarketingTextEnabled?: boolean;
  loginMarketingImageEnabled?: boolean;
  loginMarketingImageUrl?: string;
  loginMarketingImageX?: number;
  loginMarketingImageY?: number;
  loginMarketingImageScale?: number;
  loginMarketingImageAnim?: 'none' | 'floating' | 'bounce' | 'pulse' | 'wave' | 'spin-slow' | 'shake' | 'zoom' | 'slide-side' | 'swing' | 'heartbeat' | 'rubber-band' | 'glitch' | 'rotate-y';
  loginSalesTitleFont?: string;
  loginSalesTitleSize?: number;
  loginSalesTitleWidth?: number;
  loginSalesTitleHeight?: number;
  loginSalesTitleX?: number;
  loginSalesTitleY?: number;
  loginSalesTitleAnim?: 'none' | 'fade-in' | 'slide' | 'bounce' | 'pulse' | 'glitch';
  loginSalesTitleColor?: string;

  loginSalesTextFont?: string;
  loginSalesTextSize?: number;
  loginSalesTextWidth?: number;
  loginSalesTextHeight?: number;
  loginSalesTextX?: number;
  loginSalesTextY?: number;
  loginSalesTextAnim?: 'none' | 'typing' | 'fade-in' | 'slide';
  loginSalesTextColor?: string;

  loginFeaturesX?: number;
  loginFeaturesY?: number;
  loginFeaturesAnimSpeed?: number;
  loginFeaturesColor?: string;
  loginFeaturesTextColor?: string;
  loginFeaturesBorderRadius?: number;
  loginFeaturesPadding?: number;
  loginFeaturesGap?: number;
  loginFeaturesAnimType?: 'none' | 'bounce' | 'pulse' | 'float' | 'wave';

  loginBtnPlansText?: string;
  loginBtnPlansSubtext?: string;
  loginBtnPlansIcon?: string;
  loginBtnPlansShowIcon?: boolean;
  loginBtnPlansColor?: string;
  loginBtnPlansTextColor?: string;
  loginBtnRequestText?: string;
  loginBtnRequestSubtext?: string;
  loginBtnRequestIcon?: string;
  loginBtnRequestShowIcon?: boolean;
  loginBtnRequestColor?: string;
  loginBtnRequestTextColor?: string;
  loginBtnRegularizeText?: string;
  loginBtnRegularizeSubtext?: string;
  loginBtnRegularizeIcon?: string;
  loginBtnRegularizeShowIcon?: boolean;
  loginBtnRegularizeColor?: string;
  loginBtnRegularizeTextColor?: string;
  loginBtnSupportText?: string;
  loginBtnSupportSubtext?: string;
  loginBtnSupportIcon?: string;
  loginBtnSupportShowIcon?: boolean;
  loginBtnSupportColor?: string;
  loginBtnSupportTextColor?: string;
  loginButtonsOrder?: ('Plans' | 'Request' | 'Regularize' | 'Support' | 'Demo')[];
  loginCopyrightText?: string;
  loginCopyrightPosition?: 'below-panel' | 'inside-panel' | 'bottom-center';
  loginYoutubeUrls?: string[];
  globalBanMessage?: string;
  globalSuspensionMessage?: string;
  globalFontFamily?: string;
  mainMenuOrder?: View[];
  menuStructure?: MenuCategory[];
  menuShortcuts?: Record<string, string>;
  borderRadius: string;
  glassMode: boolean;
  sidebarBubbles: boolean;
  customLabels?: Record<string, string>;
  plans?: Plan[];
  supportUrl?: string;
  paymentInstructions?: string;
  mercadoPagoAccessToken?: string;
  footerText?: string;
  whatsappLink?: string;
  whatsappSupportMessage?: string;
  defaultGracePeriod?: number;
  billingApprovedMessage?: string;
  billingThankYouMessage?: string;
  billingManualPendingMessage?: string;
  affiliateBasePrice?: number;
  affiliateCommissionPercent?: number;
  
  supportPageTitle?: string;
  supportPageContent?: string;

  headerFontSize?: number;
  headerFontWeight?: 'normal' | 'bold' | 'black';
  headerTextColor?: string;
  headerAlign?: 'left' | 'center' | 'right';
  headerMarginTop?: number;
  headerMarginLeft?: number;
  headerMarginBottom?: number;

  logoWidth?: number;
  logoHeight?: number;
  logoKeepAspect?: boolean;
  logoMarginTop?: number;
  logoMarginLeft?: number;

  sidebarMainColor?: string;
  sidebarGradientEnabled?: boolean;
  sidebarSecondaryColor?: string;
  sidebarGradientDirection?: 'vertical' | 'horizontal';
  sidebarGradientIntensity?: number;
  sidebarBorderRadius?: number;
  sidebarUsernameColor?: string;
  sidebarTextColor?: string;

  workspaceBgColor?: string;
  workspaceTheme?: 'none' | 'aurora' | 'particles' | 'matrix' | 'rain' | 'stars' | 'universe' | 'galaxy' | 'cosmos' | 'techno' | 'cyber' | 'neon';
  workspaceThemeColorEnabled?: boolean;
  workspaceThemeColor?: string;
  workspaceGradientEnabled?: boolean;
  workspaceSecondaryColor?: string;

  loginFieldColor?: string;
  loginBtnColor?: string;
  loginBorderRadius?: number;
  loginFieldPadding?: number;
  loginButtonPadding?: number;
  loginFieldBorderRadius?: number;
  loginButtonBorderRadius?: number;
  loginAnimIntensity?: number;
  loginBoxBgColor?: string;
  loginBoxBorderColor?: string;
  loginBoxTitleColor?: string;
  loginBoxBtnColor?: string;
  loginBoxTextColor?: string;
  loginBoxPlaceholderColor?: string;
  loginBoxBorderRadius?: number;
  loginBoxPadding?: number;
  loginScreenBgType?: 'color' | 'image' | 'video' | 'gif';
  loginScreenBgUrl?: string;
  loginBoxBorderImageUrl?: string;
  loginBoxBorderImageScale?: number;
  loginBoxBorderImageX?: number;
  loginBoxBorderImageY?: number;
  loginScreenBgColor?: string;
  loginScreenBgLoop?: boolean;
  loginMarketingPrimaryColor?: string;
  loginThematicBorder?: string;
  loginBoxThemes?: { name: string; settings: Partial<AppSettings> }[];
  loginTextColor?: string;
  loginTextColorEnabled?: boolean;
  workspaceBgColorEnabled?: boolean;
  loginBoxBgColorEnabled?: boolean;
  loginBoxBorderColorEnabled?: boolean;
  loginBoxTitleColorEnabled?: boolean;
  loginBoxBtnColorEnabled?: boolean;
  loginBoxTextColorEnabled?: boolean;
  loginBoxPlaceholderColorEnabled?: boolean;
  loginScreenBgColorEnabled?: boolean;
  loginMarketingPrimaryColorEnabled?: boolean;
  loginTheme?: 'light' | 'dark';
  sidebarMainColorEnabled?: boolean;
  sidebarTextColorEnabled?: boolean;
  sidebarSecondaryColorEnabled?: boolean;
  loginEffectColorEnabled?: boolean;
  showDemoLink?: boolean;
  demoLinkText?: string;
  loginBtnPlansEnabled?: boolean;
  loginBtnRequestEnabled?: boolean;
  loginBtnRegularizeEnabled?: boolean;
  loginBtnSupportEnabled?: boolean;
  affiliateSystemEnabled?: boolean;
  tablesSystemEnabled?: boolean;
  kdsEnabled?: boolean;
  suppliersEnabled?: boolean;
  financialFlowEnabled?: boolean;
  reservationsEnabled?: boolean;
  
  // Configurações Detalhadas dos Módulos Adicionais
  kdsAutoRefreshInterval?: number;
  kdsShowDeliveredOrders?: boolean;
  kdsSoundNotification?: boolean;
  kdsFontSize?: 'small' | 'medium' | 'large';
  kdsSendOnPrint?: boolean;
  kdsShowOrderNumber?: boolean;
  kdsShowTableOrDirect?: boolean;
  kdsShowOrderTime?: boolean;
  kdsCardSize?: 'small' | 'medium' | 'large';
  kdsOrdersPerRow?: number;
  kdsFullscreenMode?: boolean;
  kdsTitle?: string;
  kdsTheme?: 'light' | 'dark';
  kdsStatusColors?: {
    pending: string;
    preparing: string;
    ready: string;
  };
  
  financialFlowDefaultPeriod?: 'today' | '7d' | '30d' | 'month' | 'all';
  financialFlowShowProjections?: boolean;
  financialFlowIncludePendingFiados?: boolean;
  
  reservationsDefaultDuration?: number;
  reservationsBufferTime?: number;
  reservationsAutoConfirm?: boolean;
  reservationsShowNotesOnCard?: boolean;
  
  suppliersAutoUpdateStock?: boolean;
  suppliersNotifyLowStock?: boolean;

  globalMessageEnabled?: boolean;
  globalMessageText?: string;
  geminiApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  qrCodeMasterUrl?: string;
  qrCodeMasterExpiration?: 'none' | 'monthly';
  qrCodeMenuPdf?: string;
  qrRedirectType?: 'pdf' | 'url';
  qrRedirectUrl?: string;
  aiSettings?: AISettings;
  printSettings?: PrintSettings;
  errorPage404Title?: string;
  errorPage404Message?: string;
  errorPage404ButtonText?: string;
  errorPage404ImageUrl?: string;
  errorPage404BgColor?: string;
  errorPage404TextColor?: string;
  errorPage404ButtonColor?: string;
  errorPage404ShowSearch?: boolean;
  errorPage404ShowLinks?: boolean;
  errorPage404CustomHtml?: string;
  errorPage404Animation?: 'none' | 'fade' | 'bounce' | 'slide' | 'glitch' | 'float';
  errorPage404RedirectTime?: number;
  errorPage404ShowHomeButton?: boolean;
  errorPage404ShowSupportButton?: boolean;
  errorPage404Theme?: 'minimal' | 'modern' | 'glass' | 'brutalist' | 'retro' | 'cyberpunk' | 'nature' | 'space';
  errorPage404GradientEnabled?: boolean;
  errorPage404GradientColor?: string;
  errorPage404Pattern?: 'none' | 'dots' | 'grid' | 'noise' | 'lines';
  errorPage404SocialLinks?: SocialLink[];
  errorPage404ShowReportButton?: boolean;
  errorPage404ReportEmail?: string;
  errorPage404ReportSuccessMessage?: string;
  saleConfirmationSoundEnabled?: boolean;
  saleConfirmationSoundUrl?: string;
  saleConfirmationSoundUpload?: string;
}

export interface AISettings {
  enabled: boolean;
  movementPredictionEnabled: boolean;
  stockPredictionEnabled: boolean;
  minSalesForAnalysis: number; // Mínimo de vendas para começar a analisar
}

export interface AIPrediction {
  type: 'movement' | 'stock' | 'recommendation';
  title: string;
  message: string;
  suggestion: string;
  confidence: number;
  data?: any;
}

export interface LoginProps {
  settings: AppSettings;
  onLoginSuccess: (user: User) => void;
}

export interface AffiliateCommission {
  id: string;
  affiliateId: string;
  customerId: string;
  customerName: string;
  basePrice: number;
  sellingPrice: number;
  commissionAmount: number;
  status: 'pending' | 'paid' | 'rejected';
  createdAt: string;
  requestId?: string;
}

export interface AffiliatePaymentRequest {
  id: string;
  affiliateId: string;
  affiliateName: string;
  amount: number;
  status: 'pending' | 'paid' | 'rejected';
  createdAt: string;
  paidAt?: string;
  pixName?: string;
  pixKey?: string;
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: 'open' | 'closed' | 'replied';
  isReadByCustomer?: boolean;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

export interface DemoView {
  id: string;
  affiliateId?: string;
  timestamp: string;
  ip?: string;
  userAgent?: string;
}

export type View = 'dashboard' | 'products' | 'categories' | 'addons' | 'new-sale' | 'sales-history' | 'reports' | 'tables' | 'deliveries' | 'user-management' | 'fiados' | 'settings' | 'customer-management' | 'payment' | 'plan-management' | 'my-plan' | 'employee-management' | 'support' | 'employee-consumption' | 'employee-reports' | 'affiliates' | 'kds' | 'suppliers' | 'financial-flow' | 'reservations' | 'not-found';
