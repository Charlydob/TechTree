export type Language='es'|'en';
export type LocalizedString=string|Partial<Record<Language,string>>;
export type NodeType='question'|'action'|'command'|'check'|'warning'|'solution'|'troubleshooting'|'visual-identification'|'note'|'multimedia';
export interface Media {type:'image'|'video';url:string;alt:LocalizedString;caption?:LocalizedString}
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
 title:LocalizedString;
 description:LocalizedString;
 category:string;
 folder?:string;
 ui?:{layout?:'horizontal'|'vertical'};
 tags:string[];
 requirements?:LocalizedString[];
 operatingSystems?:string[];
 metadata?:{author?:string;version?:string;updatedAt?:string;createdFrom?:string};
 startNode:string;
 nodes:RunbookNode[];
}
