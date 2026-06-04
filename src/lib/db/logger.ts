import { db } from '@/lib/db'
import { activityLogs } from '@/lib/db/schema'

export interface LogActivityParams {
  userId: string | null
  userName: string | null
  action: string
  module: string
  targetId?: string | null
  targetName?: string | null
  ip?: string | null
  details?: any
}

export async function logActivity(params: LogActivityParams) {
  try {
    await db.insert(activityLogs).values({
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      module: params.module,
      targetId: params.targetId || null,
      targetName: params.targetName || null,
      ip: params.ip || null,
      details: params.details || null,
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}
