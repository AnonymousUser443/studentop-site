import { isUV, pointInPolygon, polygonInPolygon, validatePolygon } from './geometry.mjs';

export const CONTENT_MAP_ID = 'campus-v04-eaa124716c51375f';
export const REGION_IDS = Object.freeze(['wencui', 'beihu', 'library', 'teaching', 'wenbo', 'sports', 'tower', 'park']);
export const isRegionId = id => REGION_IDS.includes(id);
// Reference anchors only: these reproduce data.ts and never replace its UVs.
export const REFERENCE_ANCHORS = Object.freeze(Object.fromEntries([
  ['wencui',535,584],['beihu',358,459],['library',383.53911,681.16021],['teaching',390.2327,576.30071],
  ['wenbo',676.88028,586.26561],['sports',704.37769,680.49071],['tower',727,491],['park',615,285],
].map(([id,x,y]) => [id, {u:x/1000.56,v:y/1240.28003}])));
const statuses = ['recommended', 'draft', 'confirmed'];
const assetPath = value => typeof value === 'string' && /^\/assets\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 2000) => typeof value === 'string' && value.length > 0 && value.length <= max;

/** Strict cross-layer validation used before import, local restore and CLI apply.
 * Additional metadata is allowed; IDs, map binding and geometry are not guessed. */
export function validateRegionDocument(document, { requireConfirmed = false } = {}) {
  const errors = [], warnings = [];
  const issue = (code, message, target = 'document', vertex) => errors.push({ code, message, target, ...(vertex === undefined ? {} : { vertex }) });
  const geometry = (polygon, target) => { const found = validatePolygon(polygon); found.forEach(error => issue(error.code,error.message,target,error.vertex)); return found.length === 0; };
  if (!record(document)) return { valid:false, errors:[{code:'document',message:'JSON 顶层必须为对象',target:'document'}], warnings:[] };
  if (document.schema_version !== 1) issue('schema-version','只接受 schema_version: 1');
  if (document.map_id !== CONTENT_MAP_ID) issue('map-id',`map_id 必须为 ${CONTENT_MAP_ID}`);
  if (document.coordinate_system !== 'image-normalized-uv') issue('coordinate-system','坐标必须为 image-normalized-uv');
  if (!statuses.includes(document.status)) issue('status','文档状态必须是 recommended / draft / confirmed');
  const review = document.review;
  if (!record(review) || typeof review.confirmed !== 'boolean') issue('review','缺少明确的 review.confirmed');
  else if (typeof review.reviewer !== 'string' || review.reviewer.length > 100 || typeof review.notes !== 'string' || review.notes.length > 2000 || !(review.reviewedAt === null || typeof review.reviewedAt === 'string' && Number.isFinite(Date.parse(review.reviewedAt)))) issue('review-fields','review 需要字符串 reviewer / notes，以及 null 或有效时间的 reviewedAt');
  if (requireConfirmed && (document.status !== 'confirmed' || review?.confirmed !== true || !text(review?.reviewer, 100) || typeof review?.reviewedAt !== 'string' || !Number.isFinite(Date.parse(review.reviewedAt)))) issue('confirmation','应用前须现场确认，填写确认人并导出确认稿');
  const boundary = document.gameBoundary;
  const boundaryValid = record(boundary) ? geometry(boundary.polygon,'boundary') : false;
  if (!record(boundary)) issue('boundary','缺少独立 gameBoundary','boundary');
  else {
    if (boundary.id !== 'campus-game') issue('boundary-id','游戏外边界 ID 必须为 campus-game','boundary');
    if (!text(boundary.name,200)) issue('boundary-name','游戏外边界需要有效名称','boundary');
    if (!statuses.includes(boundary.status)) issue('status','外边界缺少有效状态','boundary');
    if (requireConfirmed && boundary.status !== 'confirmed') issue('confirmation','外边界尚未确认','boundary');
  }
  const regions = document.regions;
  if (!Array.isArray(regions) || regions.length !== REGION_IDS.length) issue('region-count','必须恰好包含全部 8 个分区');
  const seen = new Set(), order = new Set();
  if (Array.isArray(regions)) for (const region of regions.slice(0, 128)) {
    if (!record(region)) { issue('region','分区必须为对象'); continue; }
    const target = isRegionId(region.id) ? region.id : 'document';
    if (!isRegionId(region.id)) issue('region-id',`未知分区 ID：${String(region.id)}`);
    else if (seen.has(region.id)) issue('duplicate-id',`分区 ID 重复：${region.id}`,target);
    seen.add(region.id);
    if (region.map_id !== CONTENT_MAP_ID) issue('map-id','分区 map_id 不匹配',target);
    if (!text(region.name, 100) || !text(region.subtitle, 200)) issue('content','分区缺少名称或副标题',target);
    if (!statuses.includes(region.status)) issue('status','分区状态无效',target);
    if (requireConfirmed && region.status !== 'confirmed') issue('confirmation','分区尚未确认',target);
    if (!record(region.unlock) || region.unlock.type !== 'landmark' || !isRegionId(region.unlock.landmarkId)) issue('unlock','unlock 必须关联合法地标 ID',target);
    if (!Number.isInteger(region.revealOrder) || region.revealOrder < 0 || region.revealOrder > 1000 || order.has(region.revealOrder)) issue('reveal-order','revealOrder 必须为唯一的 0–1000 整数',target);
    order.add(region.revealOrder);
    if (region.maskImage !== null && region.maskImage !== undefined && !assetPath(region.maskImage)) issue('mask-image','maskImage 必须为本项目 /assets/ 路径或 null',target);
    if (!record(region.story) || !['chapter','title','body','verse'].every(key => text(region.story?.[key]))) issue('story','分区故事需要 chapter / title / body / verse',target);
    if (!record(region.art) || !assetPath(region.art.hero) || !text(region.art.alt, 300) || !Array.isArray(region.art.palette) || region.art.palette.length < 2 || region.art.palette.length > 8 || !region.art.palette.every(color => typeof color === 'string' && /^#[a-fA-F0-9]{6}$/.test(color))) issue('art','插画需要本地 hero 路径、alt 和 2–8 个六位色值',target);
    if (geometry(region.polygon,target)) {
      if (boundaryValid && !polygonInPolygon(region.polygon,boundary.polygon)) issue('outside-boundary','分区的边或顶点超出游戏外边界',target);
      if (REFERENCE_ANCHORS[region.id] && !pointInPolygon(REFERENCE_ANCHORS[region.id],region.polygon)) issue('landmark-outside','原有地标锚点未被同名分区覆盖；不应移动原有 UV 迁就分区',target);
    }
  }
  for (const id of REGION_IDS) if (!seen.has(id)) issue('missing-region',`缺少分区 ${id}`,id);
  const points = document.checkInPoints;
  if (!Array.isArray(points) || points.length !== REGION_IDS.length) issue('point-count','必须恰好包含全部 8 个点位候选');
  const pointIds = new Set();
  if (Array.isArray(points)) for (const point of points.slice(0,128)) {
    if (!record(point)) { issue('point','点位必须为对象'); continue; }
    const target = isRegionId(point.id) ? `point:${point.id}` : 'document';
    if (!isRegionId(point.id)) issue('point-id',`未知点位 ID：${String(point.id)}`);
    if (pointIds.has(point.id)) issue('duplicate-point',`点位 ID 重复：${point.id}`,target);
    pointIds.add(point.id);
    if (!isRegionId(point.regionId) || point.regionId !== point.id) issue('point-region','点位必须绑定原有同名分区',target);
    if (!text(point.name,100)) issue('point-name','点位缺少名称',target);
    if (!statuses.includes(point.status) || typeof point.fieldConfirmationRequired !== 'boolean') issue('status','点位需要有效状态和现场确认标记',target);
    if (requireConfirmed && (point.status !== 'confirmed' || point.fieldConfirmationRequired !== false)) issue('confirmation','点位尚未现场确认',target);
    if (typeof point.physical !== 'boolean' || point.physical !== (point.id !== 'tower')) issue('point-kind','真理之塔为现有虚拟信标，其他点位为实体参考点',target);
    if (!Number.isFinite(point.radiusM) || point.radiusM < 5 || point.radiusM > 200) issue('radius','打卡半径必须为 5–200 米',target);
    if (point.wgs84 !== undefined && (!record(point.wgs84) || !Number.isFinite(point.wgs84.latitude) || Math.abs(point.wgs84.latitude) > 85 || !Number.isFinite(point.wgs84.longitude) || Math.abs(point.wgs84.longitude) > 180 || point.wgs84.source !== 'manual-field')) issue('wgs84','现场 WGS84 须含合法纬度、经度与 manual-field 来源',target);
    if (!isUV(point.centerUv)) issue('uv-range','点位中心须为 0–1 之间的有限 UV',target);
    else {
      if (boundaryValid && !pointInPolygon(point.centerUv,boundary.polygon)) issue('point-outside','点位中心超出游戏外边界',target);
      const region = Array.isArray(regions) && regions.find(item => item?.id === point.regionId);
      if (region && validatePolygon(region.polygon).length === 0 && !pointInPolygon(point.centerUv,region.polygon)) issue('point-region-outside','打卡中心不在所属分区内',target);
    }
  }
  for (const id of REGION_IDS) if (!pointIds.has(id)) issue('missing-point',`缺少点位候选 ${id}`,`point:${id}`);
  if (document.status !== 'confirmed' || review?.confirmed !== true) warnings.push('推荐 / 草稿未经现场确认；不得当作实际校园边界或实测打卡点。');
  warnings.push('support_polygon_uv 仅为定位模型的采样覆盖范围，不能代替游戏外边界。UV 图形不是精确米制圆；候选 WGS84 在覆盖范围外属于未验证外推。');
  return { valid:errors.length === 0, errors, warnings };
}
