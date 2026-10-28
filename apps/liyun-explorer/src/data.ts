import type { Landmark, UV } from './types';
export const MAP_ID = 'campus-v04-eaa124716c51375f';
export const MAP_WIDTH = 4000;
export const MAP_HEIGHT = 4958;
export const VIEW_BOX = [0, 0, 1000.56, 1240.28003] as const;
const uv = (x: number, y: number): UV => ({ u: x / VIEW_BOX[2], v: y / VIEW_BOX[3] });
export const LANDMARKS: Landmark[] = [
 {id:'wencui',name:'文萃楼',subtitle:'人文之境 · 探索起点',uv:uv(535,584),icon:'gate',regionId:'wencui',description:'从文萃楼前出发，循着金色的指引，重新发现熟悉的校园。每一处亮起的地标，都是旅途中留下的一页。',verse:'一页书香，一程山水。',progress:3,checkInRadius:45},
 {id:'beihu',name:'北湖',subtitle:'湖光拾忆 · 水畔漫行',uv:uv(358,459),icon:'lake',regionId:'beihu',description:'湖水收拢了天光，也收拢了校园四季的倒影。沿湖慢行，听风过树梢，寻找属于你的北湖记忆。',verse:'风过湖心，拾一片秋光。',progress:7,checkInRadius:55},
 {id:'library',name:'徐特立图书馆',subtitle:'书海寻踪 · 知识之门',uv:uv(383.53911,681.16021),icon:'book',regionId:'library',description:'在书架与窗影之间，阅读成为一场没有终点的探索。这里是校园知识与记忆汇聚的地方。',verse:'灯火可亲，书页有声。',progress:7,checkInRadius:45},
 {id:'teaching',name:'综合教学大楼',subtitle:'求知之路 · 青春回响',uv:uv(390.2327,576.30071),icon:'star',regionId:'teaching',description:'走过熟悉的课堂与长廊，让寻常的求学日子，在这张地图上留下新的印记。',verse:'昨日的脚步，今日的回响。',progress:5,checkInRadius:50},
 {id:'wenbo',name:'文博中心',subtitle:'文脉相逢 · 校园故事',uv:uv(676.88028,586.26561),icon:'gate',regionId:'wenbo',description:'在校园空间中感受文化与交流的温度。点亮这一站，收录一段关于相遇的故事。',verse:'相逢于此，文脉长流。',progress:5,checkInRadius:55},
 {id:'sports',name:'体育馆',subtitle:'逐风而行 · 活力校园',uv:uv(704.37769,680.49071),icon:'sport',regionId:'sports',description:'奔跑的脚步和赛场的欢呼，是校园另一种鲜活的声音。循着这份热烈，继续前行。',verse:'少年逐风，步履生光。',progress:5,checkInRadius:55},
 {id:'tower',name:'真理之塔',subtitle:'探索信标 · 解锁区域',uv:uv(727,491),icon:'tower',regionId:'tower',description:'地图中的金色探索信标。循光抵达，唤醒沉睡的云海，让新的校园区域在眼前展开。',verse:'循光而至，云开见境。',progress:5,checkInRadius:35,isBeacon:true},
 {id:'park',name:'国防教育主题公园',subtitle:'薪火之地 · 校园记忆',uv:uv(615,285),icon:'star',regionId:'park',description:'在校园的主题空间中回望来路，发现理工精神与校园记忆。',verse:'薪火相续，理韵悠长。',progress:8,checkInRadius:35}
];
export const START_UV = { u: 0.502, v: 0.507 };
export const getLandmark = (id: string) => LANDMARKS.find(x => x.id === id);
