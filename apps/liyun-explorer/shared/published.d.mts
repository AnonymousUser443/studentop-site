import type {StudioDocument,UV} from './authoring.mjs';
export type Publication={revision:number;document:StudioDocument;knownAnchors?:Record<string,UV>;reviewedBy?:string;publishedAt?:string;preview?:boolean};
export function validPublication(value:unknown):value is Publication;
export function photoURL(id:string):string;
