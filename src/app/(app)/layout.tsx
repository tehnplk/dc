import { Sidebar } from "@/components/Sidebar";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * เลย์เอาต์ของหน้าที่อยู่ในแอปจริง — มีแถบเมนูซ้าย
 * หน้า /auth/* ไม่ได้อยู่ในกลุ่มนี้ จึงไม่มีแถบเมนู (ไม่งั้นมีปุ่มเข้าสู่ระบบซ้ำสองที่)
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const id = await readSession();
  const row = id === null ? null : await prisma.user.findFirst({
    where: { id, is_active: true, deleted_at: null },
    select: { username: true, full_name: true, position: true, email: true, role: true, cid: true,
              tel: true, org_code: true, notify: true, c_org: { select: { name: true } },
              user_role: { select: { name: true } } },
  });
  // บัญชีสำรองจาก .env = สิทธิ์จัดการระบบ (ไม่ได้อยู่ใน role)
  const me = row && { ...row, super: Boolean(process.env.SUPER_USER) && row.username === process.env.SUPER_USER };

  return (
    <>
      <Sidebar
        user={me && {
          name: me.full_name, position: me.position, org: me.c_org.name,
          email: me.email, role: me.role, roleName: me.user_role.name, super: me.super,
          me: { cid: me.cid, tel: me.tel, org_code: me.org_code, org_name: me.c_org.name, notify: me.notify },
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </>
  );
}
