import "server-only";

import { dataSource } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import { removeObjects, type Bucket } from "@/lib/supabase/storage";

/** 탈퇴 요청 뒤 이 기간이 지나면 지운다(약관 제14조 제6항, 처리방침 4항). */
const GRACE_DAYS = 30;

/**
 * 탈퇴 유예가 끝난 계정을 지운다. 파일을 먼저 지우고 인증 계정을 지운다 —
 * 인증 계정을 지우면 profiles 이하 모든 행이 cascade 로 사라진다.
 * 지운 계정 수를 돌려준다. 하루 한 번 크론이 부른다.
 */
export async function purgeDeletedAccounts(): Promise<number> {
  if (dataSource() === "mock") return 0;
  const db = createServiceClient();
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000).toISOString();
  const { data: users, error } = await db
    .from("profiles")
    .select("id")
    .not("deletion_requested_at", "is", null)
    .lt("deletion_requested_at", cutoff);
  if (error) throw error;

  let purged = 0;
  for (const { id } of users ?? []) {
    for (const bucket of ["cuts", "assets"] as Bucket[]) {
      await removeObjects(bucket, await listAll(bucket, id));
    }
    const { error: deleteError } = await db.auth.admin.deleteUser(id);
    if (deleteError) {
      console.error("[account] 계정 삭제 실패", id, deleteError);
      continue;
    }
    purged++;
  }
  return purged;
}

/** 사용자 폴더 아래 파일 전부. 폴더는 두 단계({owner}/{episode|asset}/파일)다. */
async function listAll(bucket: Bucket, ownerId: string): Promise<string[]> {
  const db = createServiceClient();
  const out: string[] = [];
  const { data: folders } = await db.storage.from(bucket).list(ownerId, { limit: 1000 });
  for (const folder of folders ?? []) {
    const { data: files } = await db.storage.from(bucket).list(`${ownerId}/${folder.name}`, { limit: 1000 });
    for (const f of files ?? []) out.push(`${ownerId}/${folder.name}/${f.name}`);
  }
  return out;
}
