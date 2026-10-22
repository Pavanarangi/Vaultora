import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { handleCors } from '../_shared/cors.ts'
import { authenticateUser, jsonResponse, errorResponse } from '../_shared/supabaseClient.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { user, profile, adminClient } = await authenticateUser(req)

    // Strictly enforce administrator role
    if (profile.role !== 'administrator') {
      await adminClient.from('audit_logs').insert({
        actor_id: user.id,
        action: 'denied',
        resource_type: 'admin',
        metadata: {
          reason: 'Non-admin attempted to access admin-users function',
        },
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })

      return errorResponse('Access denied: administrator role required', 403)
    }

    if (req.method === 'GET') {
      const { data: users, error } = await adminClient
        .from('profiles')
        .select('*')
        .order('email')

      if (error) {
        return errorResponse(`Failed to fetch users: ${error.message}`, 500)
      }

      return jsonResponse({ users })
    }

    if (req.method === 'PATCH') {
      const body = await req.json()
      const { userId, role } = body

      if (!userId || !role) {
        return errorResponse('Missing required fields: userId, role', 400)
      }

      if (!['administrator', 'owner', 'viewer'].includes(role)) {
        return errorResponse("Role must be 'administrator', 'owner', or 'viewer'", 400)
      }

      // Invariant: admin cannot change own role through this interface to prevent lockout
      if (userId === user.id) {
        return errorResponse('Cannot change your own administrative role', 400)
      }

      const { data: updated, error: updateError } = await adminClient
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        return errorResponse(`Failed to update user role: ${updateError.message}`, 500)
      }

      // Log audit event
      await adminClient.from('audit_logs').insert({
        actor_id: user.id,
        action: 'role_change',
        resource_type: 'profile',
        resource_id: userId,
        metadata: {
          target_user_id: userId,
          new_role: role,
        },
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })

      return jsonResponse({ success: true, profile: updated })
    }

    return errorResponse('Method not allowed', 405)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin action failed'
    return errorResponse(message, 401)
  }
})
