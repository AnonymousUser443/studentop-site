import type { StoryScene } from './types';

const art = '/assets/art/story12/';
const p1 = '/assets/img/p1/';
const p2 = '/assets/img/p2/';
export const scenes12: StoryScene[] = [
  {
    id: 'fe-letter', beats: ['P1-02','P1-03'], title: '把一句话交给身边的人',
    event: '蓝砚把一封信递向两把手绘邻座；信封移到台前后，真实来信计数带动纸片飞入、封面泛光，公屏只显示收到数量。',
    emotion: '亲切，轻轻打开现场的距离。',
    assets: [`${art}lanyan-envelope-v2.png`,`${art}private-envelope-v2.png`,`${art}fe-seats-review.png`],
    reuseReason: 'P1-02 蓝砚递出信；P1-03 保留递信对象与角色退场的连续运动，独立封闭信封接住视线。验收拥抱仍仅在 Fe 章首。',
  },
  {
    id: 'fe-threads', beats: ['P1-04','P1-05','P1-06'], title: '一条主线，很多条主线',
    event: '高中与大学分两拍出现，真实课程留言从上方逐张落入路线末端；蓝砚捧着课程笔记把注意力接回交流。',
    emotion: '从熟悉的秩序走向人与人的可能。',
    assets: [`${art}fe-threads-ribbons-v2.png`,`${art}lanyan-course-wonder-review.png`],
    reuseReason: 'P1-04 一条主线展开为多条纸路，P1-05 同一路网向真实课名靠近，P1-06 退后让交流成为中心；留言仅使用 course-memory 真实公开数据。',
  },
  {
    id: 'fe-duet', beats: ['P1-08','P1-09'], title: '相遇变成共同作品',
    event: '真实影片海报从画面轨道与声音轨道中合成，两个作者角色彼此靠近，作品成为下一次相遇的窗口。',
    emotion: '轻快、合作的暖意。',
    assets: [`${p1}campus-film-poster.webp`,`${art}lanyan-film-smile-review.png`],
    reuseReason: '延续刚播放的真实影片，保持共同作品与真实经历的对应关系。',
  },
  {
    id: 'fe-radius', beats: ['P1-10','P1-11','P1-12','P1-13'], title: '生活半径如何扩大',
    event: '六张真实实践照片逐张拉近再回到合照墙；团队、宣讲和实践站点展开，蓝砚携笔记回看一路遇见的人。',
    emotion: '从独自制作到看见许多具体的人。',
    assets: [`${p1}siyuan-01.webp`,`${p1}xuanjiang-01.webp`,`${p1}siyuan-02.webp`,`${p1}siyuan-03.webp`,`${p1}siyuan-04.webp`,`${p1}siyuan-05.webp`,`${art}lanyan-radius-reflect-review.png`],
    reuseReason: '四个节拍讲同一段思源实践成长，照片作为同一段经历的持续舞台道具，不重复重置。',
  },
  {
    id: 'fe-first-step', beats: ['P1-14','P1-15','P1-16'], title: '一步之后',
    event: '一个脚步跨出起点，蓝砚以四个不同动作给出行动入口，最终“合情”一章落定。',
    emotion: '有鼓励而没有说教，轻盈收束。',
    assets: [`${art}fe-first-step-route-v2.png`,`${p1}xuanjiang-01.webp`, ...['signup','practice','meet','try'].map(action=>`${art}lanyan-${action}-review.png`)],
    reuseReason: 'P1-14 以真实实践连接第一步，P1-15 同一条金纸路展开四个行动入口，P1-16 该路退成印下淡影；保持同一行动的因果与运动方向。',
  },
  {
    id: 'se-open', beats: ['P2-01','P2-02','P2-03','P2-04'], title: '把培养方案展开',
    event: '游园画卷先亮相，复核者提供的十二门课程在培养方案里逐列显现；表格折向一边，露出校园体验入口。',
    emotion: '明亮、好奇，先设规则再打开边界。',
    assets: [`${art}se-campus-unfold-v2.png`,`${p2}hanfu-03.webp`],
    reuseReason: '四个节拍是同一张培养方案与同一个游园的遮挡关系变化，不更换装饰背景。',
  },
  {
    id: 'se-shell', beats: ['P2-05','P2-06','P2-07'], title: '专业的壳，另一个自己',
    event: '电路和代码构成两片专业外壳；文化活动实拍从缝隙透出，外壳向两侧分开，成为真实经历的画框。',
    emotion: '专业身份的反差，鲜活地打开自己。',
    assets: [`${art}se-technical-shell-v2.png`,`${p2}circuit.webp`,`${p2}code.webp`,`${p2}hanfu-01.webp`],
    reuseReason: 'P2-05 将真实电路与编程画面装入同一件闭合技术外壳；P2-06 由该外壳的接缝开合；P2-07 同一对叶片退到侧幕、真实活动居中。两叶共用一个有中央接缝的完整插画，保持闭合边缘精确连续。',
  },
  {
    id: 'se-arts', beats: ['P2-08','P2-09'], title: '七艺一起登场',
    event: '协会的真实合影亮相，蓝砚携原入群码放下一幅可收起的招新卷；下一节拍的七艺实物台面展开。',
    emotion: '热闹、可亲近，传统文化可以参与。',
    assets: [`${p2}hanfu-02.webp`,`${art}se-seven-arts-v2.png`,`${art}lanyan-club-welcome-review.png`,`${art}liyunculture-wechat-qr.png`],
    reuseReason: 'P2-08 真实合影为主，七件器物在同一张竹案上于侧前景预告；P2-09 竹案整体推近，七艺名称在相应器物上方逐个落下。实物共案承托，不能被割成拼贴方块。',
  },
  {
    id: 'se-game', beats: ['P2-10','P2-11','P2-12'], title: '体验变成一场探索游戏',
    event: '真实雅集界面成为游戏台；关卡到印章再到纪念卡依次连通，蓝砚从真实图片框背后探头。',
    emotion: '动手创造的兴奋，技术融入生活。',
    assets: [`${p2}frost-ui-01.webp`,`${p2}frost-ui-02.webp`,`${art}lanyan-game-peek-review.png`],
    reuseReason: '同一个真实项目的两张界面及同一条探索路径持续演出，不能被AI替换。',
  },
  {
    id: 'se-club-film', beats: ['P2-13'], title: '真实社团影像',
    event: '带独立相框的社团原片进入舞台，讲者手动播放或暂停。',
    emotion: '把校园体验交还给真实发生的活动。',
    assets: ['/assets/video/liyunculture-club.mp4', `${p2}liyunculture-film-poster.webp`, '/assets/art/approved/media-frame-16x9.png'],
    reuseReason: '单节拍真实视频；沿用验收媒体框，影片使用用户提供的原画面和声音，不以人工合成图替代。',
  },
  {
    id: 'se-afternoon', beats: ['P2-14','P2-15','P2-16','P2-17','P2-18'], title: '一个自由下午',
    event: '不同校园入口展开为一张体验地图；行动路线逐步点亮，五个投票地点用对齐基线的柱条显示实时票数，最终落在“拥实”。',
    emotion: '多彩、开放，给观众真实的选择感。',
    assets: [`${art}se-listen-share-v2.png`,`${art}se-afternoon-map-v2.png`,`${art}se-library-counter-review.png`],
    reuseReason: 'P2-14 两类社团在同一校园长廊发生，P2-15 同景退远让“还不知道会不会喜欢”留白；P2-16 新的五站地图打开探索，P2-17 同一五站切到等宽数据比较；P2-18 归到章印。投票来自 free-afternoon。',
  },
];

/** Original renderers retained for the accepted Fe cover and the campus film. */
export const retained12 = {
  'P1-01': '已验收 Fe 拥抱封面，保持独立透明角色的视觉锚点。',
  'P1-07': '真实校园宣传片，有独立装裱和实际播放控制。',
};
