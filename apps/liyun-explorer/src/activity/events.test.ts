import { describe, expect, it } from 'vitest';
import { EVENTS, REWARDS, eventMapTarget, previewMapTarget, recordedLandmarkCount, resolveEventAction, type EventEntry, type EventStatus } from './events';

const event = (patch: Partial<EventEntry> = {}): EventEntry => ({ ...EVENTS[0], ...patch });

describe('activity catalog and truthful destinations', () => {
  it('keeps five selectable chapters and all unreleased activities as previews', () => {
    expect(EVENTS.map(item => item.title)).toEqual(['霜降雅集', '四时寻访', '校园异闻录', '校园奇遇', '往期纪事']);
    expect(new Set(EVENTS.map(item => item.id)).size).toBe(5);
    expect(EVENTS.slice(0, 4).every(item => item.status === 'upcoming' && resolveEventAction(item).kind === 'preview')).toBe(true);
    expect(EVENTS.every(item => item.rewardKeys.every(key => Boolean(REWARDS[key])))).toBe(true);
  });
  it('does not navigate upcoming or locked activities even if a map id is configured', () => {
    expect(resolveEventAction(event({ status: 'upcoming', mapId: 'beihu' })).kind).toBe('preview');
    expect(resolveEventAction(event({ status: 'locked', mapId: 'beihu', unlockCondition: '先完成正式条件' }))).toEqual({ kind: 'condition', label: '解锁条件', message: '先完成正式条件' });
  });
  it('routes active and completed entries only to existing map destinations', () => {
    expect(resolveEventAction(event({ status: 'active', mapId: 'beihu' }))).toMatchObject({ kind: 'map', landmarkId: 'beihu', label: '前往参与' });
    expect(resolveEventAction(event({ status: 'completed', route: '/map/library' }))).toMatchObject({ kind: 'map', landmarkId: 'library', label: '再次进入' });
    expect(resolveEventAction(event({ status: 'active', mapId: 'invented-map' })).kind).toBe('unavailable');
    expect(eventMapTarget({ mapId: 'beihu', route: '/map/library' })).toBeNull();
  });
  it.each(['https://example.com/map/beihu', '//example.com', 'javascript:alert(1)', '/map/../beihu', '/map/%62eihu', '/map/beihu?next=elsewhere', '/map/beihu#other', '/map/beihu\n'])('rejects unsafe or unexpected routes %s', route => {
    expect(eventMapTarget({ mapId: 'beihu', route })).toBeNull();
  });
  it('only opens a real personal collection for a configured archive', () => {
    expect(resolveEventAction(EVENTS[4])).toMatchObject({ kind: 'collection', label: '回顾我的足迹' });
    expect(resolveEventAction(event({ status: 'archived', route: '/unknown' })).kind).toBe('unavailable');
  });
  it('supports unavailable and unknown states without implying participation', () => {
    expect(resolveEventAction(event({ status: 'unavailable' }))).toMatchObject({ kind: 'unavailable', label: '稍后重试' });
    expect(resolveEventAction(event({ status: 'bad' as EventStatus })).kind).toBe('unavailable');
  });
  it('uses explicit previews for existing map landmarks and never mutates discoveries', () => {
    expect(previewMapTarget(EVENTS[0])).toBe('beihu');
    expect(previewMapTarget(event({ previewMapId: 'unknown' }))).toBeNull();
    const discoveries = ['beihu', 'beihu', 'unknown', 'library'];
    expect(recordedLandmarkCount(discoveries)).toBe(2);
    expect(discoveries).toEqual(['beihu', 'beihu', 'unknown', 'library']);
    expect(recordedLandmarkCount([])).toBe(0);
  });
});
