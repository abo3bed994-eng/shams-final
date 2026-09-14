import React from "react";
import { Pressable, View } from "react-native";
import Icon from "@/components/Icon";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { ContactEntry } from "@/context/AppContext";
import { Card, Field, SettingsScreen, useSettingsDraft, styles } from "./_shared";

export default function ContactsSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, saving, save } = useSettingsDraft();
  const updateContact = (id: string, field: keyof ContactEntry, value: string) =>
    setDraft((d) => ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, [field]: value } : c)) }));
  const deleteContact = (id: string) => setDraft((d) => ({ ...d, contacts: d.contacts.filter((c) => c.id !== id) }));
  const addContact = () => {
    const entry: ContactEntry = { id: Date.now().toString(), label: "رقم جديد", number: "", icon: "phone" };
    setDraft((d) => ({ ...d, contacts: [...d.contacts, entry] }));
  };
  return (
    <SettingsScreen title="أرقام التواصل" bottomPad={bottomPad} save={save} saving={saving}>
      <Card title="أرقام التواصل">
        {draft.contacts.map((c) => (
          <View key={c.id} style={[styles.entryBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable onPress={() => deleteContact(c.id)} style={styles.deleteBtn}>
              <Icon name="trash-2" size={16} color={colors.destructive} />
            </Pressable>
            <View style={styles.entryFields}>
              <Field label="التسمية" value={c.label} onChange={(v) => updateContact(c.id, "label", v)} placeholder="مثال: المبيعات" />
              <Field label="رقم الهاتف" value={c.number} onChange={(v) => updateContact(c.id, "number", v)} placeholder="+20 100 000 0000" keyboardType="phone-pad" />
            </View>
          </View>
        ))}
        <GoldButton label="إضافة رقم" onPress={addContact} variant="outline" size="sm" style={{ width: "100%" }} />
      </Card>
    </SettingsScreen>
  );
}
