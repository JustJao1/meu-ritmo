type Scene='routine'|'notes'|'feedback'|'finance'|'corner';

// Small, decorative still lifes. Theme colors keep the drawings at home in every palette.
export default function OrganizingIllustration({kind='routine'}:{kind?:Scene}){
 const corner=kind==='corner';
 return <svg className={'organizing-illustration'+(corner?' cozy-corner':'')} viewBox="0 0 240 150" fill="none" aria-hidden="true" focusable="false" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
  <ellipse cx="122" cy="132" rx="101" ry="7" fill="currentColor" opacity=".045" stroke="none"/>
  <path d="M22 128H220" opacity=".25"/>
  {/* A little plant, with leaves drawn individually rather than a repeated icon. */}
  <path d="M184 99L188 126H211L216 99Z" fill="var(--accent)" fillOpacity=".16"/>
  <path d="M200 99V66M200 86C183 86 179 76 181 70C192 69 199 76 200 86ZM200 76C214 76 220 65 216 59C205 60 200 66 200 76Z" fill="var(--accent)" fillOpacity=".22"/>
  <path d="M184 100H216"/>
  {corner?<>
   <path d="M38 117H132L143 125H47Z" fill="var(--paper)"/><path d="M50 108H139V117H50Z" fill="var(--accent)" fillOpacity=".18"/><path d="M61 111H121" opacity=".3"/>
   <path d="M69 68H111V96Q111 108 99 108H81Q69 108 69 96Z" fill="var(--paper)"/><path d="M112 74H119C132 74 132 94 112 94M80 56C73 46 86 44 81 33M97 56C90 46 103 43 98 32" opacity=".55"/>
   <path d="M43 89V35H156V89M99 36V87M44 61H154" opacity=".16"/><circle cx="130" cy="48" r="8" fill="var(--accent)" fillOpacity=".16" stroke="none"/>
  </>:kind==='notes'?<>
   <path d="M32 43Q58 35 91 48Q123 35 153 43V117Q120 109 91 122Q59 109 32 117Z" fill="var(--paper)"/><path d="M91 48V122M44 61Q62 57 78 63M44 77Q62 73 78 79M44 93Q62 89 78 95M104 61Q123 55 141 60M104 77Q122 71 136 76" opacity=".35"/>
   <path d="M126 112L155 66L162 71L134 117L124 121Z" fill="var(--accent)" fillOpacity=".35"/>
  </>:kind==='finance'?<>
   <path d="M40 69H137L148 120H30Z" fill="var(--paper)"/><path d="M47 74L53 37H121L127 74" fill="var(--paper)"/><path d="M64 49H110M62 60H100" opacity=".35"/><rect x="61" y="87" width="38" height="23" rx="4" fill="var(--accent)" fillOpacity=".18"/>
   <ellipse cx="153" cy="119" rx="18" ry="6" fill="var(--paper)"/><path d="M135 111V119M171 111V119"/><ellipse cx="153" cy="111" rx="18" ry="6" fill="var(--accent)" fillOpacity=".2"/>
  </>:kind==='feedback'?<>
   <path d="M32 70L91 37L151 70V119H32Z" fill="var(--paper)"/><path d="M48 80V34H134V80L91 105Z" fill="var(--paper)"/><path d="M63 51H118M63 64H108" opacity=".35"/><path d="M32 70L91 105L151 70M32 119L72 94M151 119L111 94"/>
   <path d="M91 88C74 77 79 68 87 72L91 77L95 72C103 68 108 77 91 88Z" fill="var(--accent)" fillOpacity=".32" stroke="none"/>
  </>:<>
   <path d="M38 36H143V121H38Z" fill="var(--paper)"/><path d="M38 55H143M59 29V43M122 29V43"/>
   <rect x="53" y="70" width="15" height="15" rx="4" fill="var(--accent)" fillOpacity=".18"/><path d="M57 77L61 81L67 73M78 77H127M78 101H114" opacity=".7"/><rect x="53" y="94" width="15" height="15" rx="4" opacity=".3"/>
   <path d="M146 96H171V116Q171 125 162 125H155Q146 125 146 116ZM172 101H177C185 101 183 114 172 114M154 88C148 82 159 79 155 73" fill="var(--paper)"/>
  </>}
 </svg>;
}
