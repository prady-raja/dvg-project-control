import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { activeMembers, canManageProject, memberIdsOf, resolveRank } from '../../shared/access.ts';
import { makeDb } from '../../shared/dbCore.ts';
import { fail, getOne } from '../../shared/records.ts';
import { normalizeAreaName } from '../../shared/villaAreas.ts';
import { planScopeCopy } from '../../shared/villaScopeCopy.ts';
import { withLog } from '../../shared/log.ts';

const MAX_TARGETS = 40;

/**
 * Copy the floors and rooms of one villa to others, skipping rooms the target
 * already has. Most villas of a type are identical, so this replaces entering the
 * same register villa by villa.
 */
async function handler(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;
    const db = makeDb({ entities: svc });
    const sourceId = String(body?.sourceLocationId || '');
    const targetIds = [...new Set((Array.isArray(body?.targetLocationIds) ? body.targetLocationIds : []).map(String))]
      .filter((id) => id && id !== sourceId);
    if (!sourceId) throw fail('Choose the villa to copy from.');
    if (!targetIds.length) throw fail('Choose at least one villa to copy to.');
    if (targetIds.length > MAX_TARGETS) throw fail(`Copy to at most ${MAX_TARGETS} villas at a time.`);

    const source = await getOne(svc.Location, sourceId);
    if (!source) throw fail('The villa to copy from no longer exists.', 404);
    const rank = await resolveRank(base44, source.project_id, user);
    if (!canManageProject(rank)) throw fail('Only a Project Editor or an administrator can copy floors and rooms.', 403);

    const memberIds = memberIdsOf(await activeMembers(base44, source.project_id));
    const [sourceFloors, sourceAreas] = await Promise.all([
      db.readAll('VillaFloor', { location_id: sourceId }),
      db.readAll('VillaArea', { location_id: sourceId }),
    ]);
    if (!sourceFloors.items.length && !sourceAreas.items.length) throw fail('That villa has no floors or rooms to copy yet.');

    const results = [];
    for (const targetId of targetIds) {
      const target = await getOne(svc.Location, targetId);
      if (!target || target.project_id !== source.project_id) {
        results.push({ location_id: targetId, error: 'Not a villa in this project.' });
        continue;
      }
      const [targetFloors, targetAreas] = await Promise.all([
        db.readAll('VillaFloor', { location_id: targetId }),
        db.readAll('VillaArea', { location_id: targetId }),
      ]);
      const plan = planScopeCopy({
        sourceFloors: sourceFloors.items,
        sourceAreas: sourceAreas.items,
        targetFloors: targetFloors.items,
        targetAreas: targetAreas.items,
      });
      const base = { project_id: target.project_id, phase_id: target.phase_id || null, location_id: targetId, active: true, member_ids: memberIds };

      const floorIdByKey = new Map(targetFloors.items.map((f) => [String(f.floor_code || f.floor_name || '').trim().toLowerCase(), f.id]));
      for (const floor of plan.floorsToCreate) {
        const { key, ...fields } = floor;
        const created = await svc.VillaFloor.create({ ...base, ...fields });
        floorIdByKey.set(key, created.id);
      }
      for (const area of plan.areasToCreate) {
        const { floorKey, ...fields } = area;
        await svc.VillaArea.create({
          ...base,
          ...fields,
          floor_id: floorIdByKey.get(floorKey) || null,
          normalized_name: normalizeAreaName(fields.area_name),
          source: 'Manual',
        });
      }
      results.push({
        location_id: targetId,
        villa: target.villa_code,
        floors_added: plan.floorsToCreate.length,
        rooms_added: plan.areasToCreate.length,
        rooms_skipped: plan.skippedAreas.length,
      });
    }
    return Response.json({ source: source.villa_code, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error?.status || 500 });
  }
}

export default withLog('villaScopeCopy', handler);
