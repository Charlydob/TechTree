export type NodeType='question'|'action'|'command'|'check'|'warning'|'solution'|'visual-identification'|'note';
export interface Media {type:'image'|'video';url:string;alt:string;caption?:string}
export interface Outcome {id:string;label:string;nextNode?:string;description?:string;media?:Media[]}
export interface RunbookNode {id:string;type:NodeType;title:string;body?:string;os?:string[];command?:string;expectedResult?:string;destructive?:boolean;media?:Media[];outcomes?:Outcome[];nextNode?:string}
export interface Runbook {schemaVersion:1;id:string;title:string;description:string;category:string;tags:string[];requirements?:string[];operatingSystems?:string[];metadata?:{author?:string;version?:string;updatedAt?:string};startNode:string;nodes:RunbookNode[]}
