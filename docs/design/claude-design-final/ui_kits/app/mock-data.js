window.SEMockData = (function(){
const categories = [
{value:'groceries',label:'بقالة',icon:'shopping-cart',color:'#0F7A5C'},
{value:'transport',label:'مواصلات',icon:'car',color:'#3B82F6'},
{value:'housing',label:'سكن',icon:'home',color:'#F59E0B'},
{value:'dining',label:'مطاعم',icon:'utensils',color:'#DC2626'},
{value:'health',label:'صحة',icon:'heart-pulse',color:'#8B5CF6'},
{value:'other',label:'أخرى',icon:'more-horizontal',color:'#64748B'},
];
const incomeRecords = [
{id:'i1',title:'راتب شهري',category:'دخل ثابت',date:'01/07/2026',amount:'8,500.00',status:null,actor:'سارة العتيبي'},
{id:'i2',title:'عمل حر — تصميم',category:'دخل إضافي',date:'05/07/2026',amount:'1,200.00',status:null,actor:'سارة العتيبي'},
{id:'i3',title:'استرداد تأمين',category:'أخرى',date:'09/07/2026',amount:'350.00',status:null,actor:'محمد العتيبي'},
];
const expenseRecords = [
{id:'e1',title:'بقالة العائلة',category:'بقالة',subcategory:'مشتريات منزلية',date:'12/07/2026',amount:'145.00',status:null,actor:'سارة العتيبي',icon:'shopping-cart',hasReceipt:true},
{id:'e2',title:'محطة وقود أرامكو',category:'مواصلات',subcategory:'وقود',date:'10/07/2026',amount:'220.00',status:null,actor:'محمد العتيبي',icon:'car',hasReceipt:true},
{id:'e3',title:'مطعم نجد',category:'مطاعم',date:'08/07/2026',amount:'96.50',status:null,actor:'سارة العتيبي',icon:'utensils',hasReceipt:false},
{id:'e4',title:'فاتورة الكهرباء',category:'سكن',date:'06/07/2026',amount:'410.00',status:null,actor:'سارة العتيبي',icon:'home',hasReceipt:false},
{id:'e5',title:'صيدلية النهدي',category:'صحة',subcategory:'صيدلية',date:'03/07/2026',amount:'78.25',status:null,actor:'محمد العتيبي',icon:'heart-pulse',hasReceipt:true},
];
const aiQueue = [
{id:'a1',fileName:'receipt-2026-07-13.jpg',status:'ready',currency:'SAR',fields:{amount:'62.00',notes:'كافيه العنود',date:'13/07/2026',category:{value:'cafes',label:'مقاهي',icon:'coffee',isSub:true,mainLabel:'طعام'}}},
{id:'a2',fileName:'invoice-jarir-2026-07-11.pdf',status:'ready',currency:'USD',fields:{amount:'389.00',notes:'مكتبة جرير',date:'11/07/2026',category:{value:'home',label:'المنزل',icon:'home',isSub:true,mainLabel:'عائلة'}}},
{id:'a3',fileName:'receipt-blurry-2026-07-09.jpg',status:'failed',currency:'SAR',fields:{amount:'',notes:'',date:'',category:null},error:'تعذّرت قراءة الإيصال. الصورة غير واضحة — جرّب صورة أوضح أو أدخل القيم يدويًا.'},
];
const categoryHierarchy = [
{value:'transport',label:'مواصلات',subs:[{value:'fuel',label:'وقود'},{value:'maintenance',label:'صيانة'},{value:'rent',label:'إيجار'}]},
{value:'food',label:'طعام',subs:[{value:'restaurants',label:'مطاعم'},{value:'cafes',label:'مقاهي'}]},
{value:'family',label:'عائلة',subs:[{value:'home',label:'المنزل'},{value:'children',label:'الأطفال'},{value:'maintenance',label:'صيانة'}]},
{value:'bills',label:'فواتير',subs:[{value:'electricity',label:'كهرباء'},{value:'telecom',label:'اتصالات'},{value:'internet',label:'إنترنت'},{value:'gas',label:'غاز'}]},
];
const expenseCategoryTree = [
{value:'transport',label:'مواصلات',icon:'car',subs:[{value:'fuel',label:'وقود',icon:'fuel'},{value:'maintenance',label:'صيانة',icon:'wrench'},{value:'taxi',label:'أجرة',icon:'car-taxi-front'}]},
{value:'food',label:'طعام',icon:'utensils',subs:[{value:'restaurants',label:'مطاعم',icon:'utensils'},{value:'cafes',label:'مقاهي',icon:'coffee'}]},
{value:'family',label:'عائلة',icon:'users',subs:[{value:'home',label:'المنزل',icon:'home'},{value:'children',label:'الأطفال',icon:'baby'},{value:'maintenance',label:'صيانة',icon:'wrench'}]},
{value:'bills',label:'فواتير',icon:'receipt',subs:[{value:'electricity',label:'كهرباء',icon:'zap'},{value:'telecom',label:'اتصالات',icon:'phone'},{value:'internet',label:'إنترنت',icon:'wifi'},{value:'gas',label:'غاز',icon:'flame'}]},
{value:'investments',label:'استثمارات',icon:'trending-up',disabled:true,subs:[]},
];
const incomeCategoryTree = [
{value:'fixed',label:'دخل ثابت',icon:'wallet',subs:[{value:'salary',label:'راتب',icon:'banknote'},{value:'pension',label:'معاش',icon:'landmark'}]},
{value:'extra',label:'دخل إضافي',icon:'sparkles',subs:[{value:'freelance',label:'عمل حر',icon:'briefcase'},{value:'refund',label:'استرداد',icon:'rotate-ccw'}]},
];
const incomeCategoryTreeEn = [
{value:'fixed',label:'Fixed income',icon:'wallet',subs:[{value:'salary',label:'Salary',icon:'banknote'},{value:'pension',label:'Pension',icon:'landmark'}]},
{value:'extra',label:'Extra income',icon:'sparkles',subs:[{value:'freelance',label:'Freelance',icon:'briefcase'},{value:'refund',label:'Refund',icon:'rotate-ccw'}]},
];
const workspaceCurrency = 'SAR';
const files = [
{id:'f1',fileName:'receipt-2026-07-13.jpg',size:'1.2 MB',date:'13/07/2026',status:'ready',fileType:'image',linkedTitle:null},
{id:'f2',fileName:'invoice-jarir-2026-07-11.pdf',size:'340 KB',date:'11/07/2026',status:'ready',fileType:'pdf',linkedTitle:null},
{id:'f3',fileName:'receipt-2026-07-08.jpg',size:'980 KB',date:'08/07/2026',status:'confirmed',fileType:'image',linkedTitle:'بقالة العائلة'},
{id:'f4',fileName:'receipt-blurry-2026-07-09.jpg',size:'2.1 MB',date:'09/07/2026',status:'failed',fileType:'image',linkedTitle:null},
{id:'f5',fileName:'invoice-fuel-2026-07-14.pdf',size:'510 KB',date:'14/07/2026',status:'processing',fileType:'pdf',linkedTitle:null},
{id:'f6',fileName:'receipt-electricity-2026-07-06.jpg',size:'860 KB',date:'06/07/2026',status:'confirmed',fileType:'image',linkedTitle:'فاتورة الكهرباء'},
];
const members = [
{id:'m1',name:'سارة العتيبي',email:'sara@example.com',role:'مالك',roleKey:'owner'},
{id:'m2',name:'محمد العتيبي',email:'mohammed@example.com',role:'مشرف',roleKey:'admin'},
{id:'m3',name:'نورة العتيبي',email:'noura@example.com',role:'عضو',roleKey:'member'},
{id:'m4',name:'خالد العتيبي',email:'khaled@example.com',role:'مشاهد',roleKey:'viewer'},
];
const history = [
{id:'h1',action:'تم تأكيد مصروف مستخرج بالذكاء الاصطناعي',detail:'62.00 ر.س · كافيه العنود',actor:'سارة العتيبي',date:'13/07/2026',time:'10:42 ص',type:'ai'},
{id:'h2',action:'تم حذف مصروف',detail:'45.00 ر.س · توصيل طلبات',actor:'محمد العتيبي',date:'12/07/2026',time:'04:15 م',type:'expense-delete'},
{id:'h3',action:'تمت إضافة دخل',detail:'1,200.00 ر.س · عمل حر',actor:'سارة العتيبي',date:'05/07/2026',time:'09:03 ص',type:'income'},
{id:'h4',action:'تمت دعوة عضو جديد',detail:'خالد العتيبي كمشاهد',actor:'سارة العتيبي',date:'02/07/2026',time:'01:27 م',type:'member'},
];
const roles = [
{key:'owner',label:'مالك'},{key:'admin',label:'مشرف'},{key:'member',label:'عضو'},{key:'viewer',label:'مشاهد'},
];
return { categories, incomeRecords, expenseRecords, aiQueue, files, members, history, roles, categoryHierarchy, expenseCategoryTree, incomeCategoryTree, incomeCategoryTreeEn, workspaceCurrency };
})();
