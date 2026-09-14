# 💾 Firestore Backup Script

نسخ احتياطي يومي لجميع بيانات Firebase Firestore إلى ملفات JSON محلية.

## 📋 الإعداد لمرة واحدة

### 1. احصل على مفتاح حساب الخدمة من Firebase

1. افتح [Firebase Console](https://console.firebase.google.com/project/shamstexapp/settings/serviceaccounts/adminsdk)
2. اضغط **Generate new private key**
3. سيتم تحميل ملف JSON
4. احفظه باسم `service-account.json` داخل هذا المجلد:
   ```
   scripts/backup/service-account.json
   ```

> ⚠️ **مهم جداً:** هذا الملف يحتوي على كلمات سرّية كاملة لمشروعك. لا ترفعه إلى Git أبداً ولا ترسله لأحد. (تمت إضافته تلقائياً إلى `.gitignore`)

### 2. تأكد من تثبيت الحزم

```bash
pnpm install
```

## 🚀 التشغيل اليدوي

```bash
pnpm --filter @workspace/scripts run backup
```

ستظهر رسائل مثل:
```
[2026-04-19 10:30:00] 📦 Dumping collection: orders
[2026-04-19 10:30:01]    ↳ 247 documents
✅ Backup complete: scripts/backup/backups/backup-2026-04-19T10-30-00.json
```

## ⏰ التشغيل التلقائي اليومي (Cron)

### على لينكس / ماك:
```bash
crontab -e
```
أضف هذا السطر (يعمل يومياً الساعة 3 صباحاً):
```
0 3 * * * cd /full/path/to/your/project && /usr/local/bin/pnpm --filter @workspace/scripts run backup >> /tmp/shamstex-backup.log 2>&1
```

### على ويندوز:
- افتح **Task Scheduler**
- أنشئ مهمة جديدة تعمل يومياً
- الأمر: `pnpm --filter @workspace/scripts run backup`
- المسار: مجلد المشروع

### على خادم سحابي (موصى به):
يمكنك تشغيل السكربت على أي سيرفر صغير أو حتى على Replit نفسه عبر Scheduled Deployments.

## ⚙️ خيارات متقدمة

استخدم متغيرات البيئة لتخصيص السلوك:

| المتغيّر | القيمة الافتراضية | الوصف |
|---------|------------------|-------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `./service-account.json` | مسار مفتاح الخدمة |
| `BACKUP_DIR` | `./backups` | مكان حفظ النسخ |
| `BACKUP_COLLECTIONS` | `users,products,orders,categories,settings,audit_log,push_tokens,sessions` | المجموعات المراد نسخها (مفصولة بفواصل) |
| `BACKUP_KEEP` | `30` | عدد النسخ المحتفظ بها (تُحذف الأقدم تلقائياً) |

مثال:
```bash
BACKUP_KEEP=60 BACKUP_DIR=/mnt/external/shamstex pnpm run backup
```

## 🔄 الاستعادة من نسخة احتياطية

ملف النسخة الاحتياطية هو JSON قابل للقراءة بأي محرر. لاستعادة بيانات معيّنة، استخدم Firebase Admin SDK لكتابة بياناتها مرة أخرى.

> 💡 يمكنني كتابة سكربت `restore-firestore.mjs` عند الحاجة — راسلني إن أردت.

## 🛡️ الأمان

- ملف `service-account.json` يحتوي على صلاحيات **كاملة** على قاعدة بياناتك. عامله كأنه كلمة مرور.
- خزّن النسخ الاحتياطية في مكان آمن (محرّك مشفّر، خدمة سحابية مع تشفير).
- يفضّل رفع النسخ تلقائياً إلى Google Drive / Dropbox / S3 عبر سكربت إضافي.
