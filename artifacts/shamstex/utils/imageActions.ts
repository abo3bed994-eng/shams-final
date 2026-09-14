import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { Alert, Platform } from "react-native";

function extFromUri(uri: string): string {
  const m = uri.match(/\.([a-zA-Z0-9]+)(\?|#|$)/);
  if (m) return m[1].toLowerCase();
  if (uri.startsWith("data:image/png")) return "png";
  return "jpg";
}

async function materializeLocalFile(uri: string, baseName: string): Promise<string> {
  const ext = extFromUri(uri);
  const target = `${FileSystem.cacheDirectory}${baseName}_${Date.now()}.${ext}`;

  if (uri.startsWith("data:")) {
    const base64 = uri.split(",")[1] ?? "";
    await FileSystem.writeAsStringAsync(target, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return target;
  }

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const res = await FileSystem.downloadAsync(uri, target);
    return res.uri;
  }

  // file:// or content:// — already local
  return uri;
}

export async function saveImageToDevice(uri: string, baseName = "shamstex"): Promise<void> {
  if (Platform.OS === "web") {
    Alert.alert("غير مدعوم", "حفظ الصورة متاح على الموبايل فقط");
    return;
  }
  try {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("صلاحية مطلوبة", "يرجى السماح بالوصول إلى الصور لحفظها");
      return;
    }
    const local = await materializeLocalFile(uri, baseName);
    await MediaLibrary.saveToLibraryAsync(local);
    Alert.alert("تم", "تم حفظ الصورة في معرض الجهاز");
  } catch (e: any) {
    console.warn("[saveImage] failed:", String(e?.message || e));
    Alert.alert("خطأ", "تعذّر حفظ الصورة، حاول مرة أخرى");
  }
}

export async function shareImage(uri: string, baseName = "shamstex"): Promise<void> {
  if (Platform.OS === "web") {
    Alert.alert("غير مدعوم", "المشاركة متاحة على الموبايل فقط");
    return;
  }
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert("غير مدعوم", "المشاركة غير متاحة على هذا الجهاز");
      return;
    }
    const local = await materializeLocalFile(uri, baseName);
    await Sharing.shareAsync(local, {
      mimeType: extFromUri(local) === "png" ? "image/png" : "image/jpeg",
      dialogTitle: "مشاركة الصورة",
    });
  } catch (e: any) {
    console.warn("[shareImage] failed:", String(e?.message || e));
    Alert.alert("خطأ", "تعذّر مشاركة الصورة، حاول مرة أخرى");
  }
}
