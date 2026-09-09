export type Language='es'|'en';
export type LocalizedString=string|Partial<Record<Language,string>>;
export type NodeType='question'|'action'|'command'|'check'|'warning'|'solution'|'troubleshooting'|'visual-identification'|'note'|'multimedia';
export type MediaType='image'|'audio'|'video'|'youtube'|'link';
export interface AudioMarker {id:string;time:number;title:string}
export interface Media {
 id?:string;
 type:MediaType;
 url:string;
 alt:LocalizedString;
 filename?:string;
 mimeType?:string;
 size?:number;
 createdAt?:string;
 duration?:number;
 metadata?:Record<string,string|number|boolean|null>;
 audioMarkers?:AudioMarker[];
 caption?:LocalizedString;
 description?:LocalizedString;
 title?:LocalizedString;
}
export interface Outcome {id:string;label:LocalizedString;nextNode?:string;description?:LocalizedString;media?:Media[]}
export interface RunbookNode {
 id:string;
 type:NodeType;
 title:LocalizedString;
 ui?:{x?:number;y?:number};
 body?:LocalizedString;
 os?:string[];
 command?:string;
 expectedResult?:LocalizedString;
 destructive?:boolean;
 media?:Media[];
 outcomes?:Outcome[];
 nextNode?:string;
 symptoms?:LocalizedString[];
 errorMessages?:string[];
 aliases?:LocalizedString[];
 keywords?:string[];
 tags?:string[];
 cause?:LocalizedString;
 finalSolution?:LocalizedString;
}
export interface Runbook {
 schemaVersion:1|2;
 id:string;
 serverVersion?:number;
 title:LocalizedString;
 description:LocalizedString;
 category:string;
 folder?:string;
 folderId?:string;
 ui?:{layout?:'horizontal'|'vertical'};
 tags:string[];
 requirements?:LocalizedString[];
 operatingSystems?:string[];
 metadata?:{author?:string;version?:string;updatedAt?:string;createdFrom?:string};
 startNode:string;
 nodes:RunbookNode[];
}
