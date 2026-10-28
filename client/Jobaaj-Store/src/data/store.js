const photo = (id, width = 720) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`

export const categories = [
  { name: 'Decor', image: photo('photo-1616486338812-3dadae4b4ace') },
  { name: 'Lighting', image: photo('photo-1507473885765-e6ed057f782c') },
  { name: 'Furniture', image: photo('photo-1499933374294-4584851497cc') },
  { name: 'Dining', image: photo('photo-1490312278390-ab64016e0aa9') },
  { name: 'Lifestyle', image: photo('photo-1494438639946-1ebd1d20bf85') },
]

const rawProducts = [
  ['Solace Table Lamp','solace-table-lamp','Lighting',8490,'photo-1507473885765-e6ed057f782c','Brushed brass and a softly diffused linen shade bring a warm pool of light to the end of the day.','Brushed brass · linen',4.8,36,14,true,true],
  ['Forma Oak Side Table','forma-oak-side-table','Furniture',12900,'photo-1560023971-4c2b75bbf5de','A clean-lined solid oak table with a quiet sculptural profile.','Solid oak',4.9,24,8,true,true],
  ['Riverstone Serving Bowl','riverstone-serving-bowl','Dining',2450,'photo-1772453609632-2f4aa857f56e','Hand-finished stoneware with a tactile matte glaze, made for serving or simply keeping close.','Hand-glazed stoneware',4.7,18,31,true,true],
  ['Aara Woven Cushion','aara-woven-cushion','Decor',1890,'photo-1494281232141-90a40b0b06c9','Textural cotton weave in a warm, grounded palette.','100% cotton',4.6,21,42,true,false],
  ['Morrow Glass Vase','morrow-glass-vase','Decor',3250,'photo-1563261883-25b59aad64d8','A gently irregular silhouette in hand-blown smoke glass.','Hand-blown glass',4.8,15,19,true,true],
  ['Kora Pendant Light','kora-pendant-light','Lighting',15750,'photo-1578678809569-1a8ead9cb802','A generous woven pendant that casts an easy, patterned glow.','Natural rattan',4.7,12,7,false,true],
  ['Tide Carved Tray','tide-carved-tray','Lifestyle',2750,'photo-1568616461622-18ac2a7391e0','A softly sculpted mango-wood tray for daily rituals and little things.','Mango wood',4.5,9,26,true,false],
  ['Field Linen Throw','field-linen-throw','Decor',6200,'photo-1614622350812-96b09c78af77','Relaxed linen blend with a generous drape and naturally varied texture.','Linen and cotton',4.9,32,16,false,true],
  ['Nami Ceramic Planter','nami-ceramic-planter','Decor',2100,'photo-1683688412173-148e0ba57c19','A considered home for leafy things, finished in a sandy satin glaze.','Stoneware',4.6,11,28,false,false],
  ['Alder Dining Chair','alder-dining-chair','Furniture',18900,'photo-1503602642458-232111445657','A solid ash frame and woven seat make a lasting place at the table.','Ash wood · cane',4.8,19,6,false,true],
  ['Sora Stoneware Set','sora-stoneware-set','Dining',4890,'photo-1551807306-4bcd16b92a41','A four-piece everyday setting with a softly speckled glaze.','Stoneware · set of 4',4.7,27,22,false,true],
  ['Pollen Candle Holder','pollen-candle-holder','Decor',1450,'photo-1603006905003-be475563bc59','Small cast-metal holder with an easy, balanced shape.','Cast aluminium',4.4,8,36,false,false],
  ['Hearth Walnut Stool','hearth-walnut-stool','Furniture',9800,'photo-1670910438214-4bb30c0b31a6','A useful extra seat with a solid walnut frame and softened edges.','American walnut',4.8,14,9,false,false],
  ['Luma Wall Sconce','luma-wall-sconce','Lighting',7200,'photo-1513506003901-1e6a229e2d15','Compact wall lighting with a directional shade and warm finish.','Powder-coated steel',4.6,10,12,false,false],
  ['Kiyo Cotton Napkins','kiyo-cotton-napkins','Dining',1350,'photo-1494438639946-1ebd1d20bf85','A set of four softly washed cotton napkins in a natural weave.','Cotton · set of 4',4.5,17,48,false,false],
  ['Contour Mirror','contour-mirror','Decor',11200,'photo-1618221195710-dd6b41faaea6','A slim oak frame and rounded corners bring an easy softness.','Oak · clear glass',4.8,16,5,false,false],
  ['Silt Table Runner','silt-table-runner','Dining',2200,'photo-1614622350812-96b09c78af77','Washed linen with a simple hem for unhurried tables.','Linen blend',4.5,12,20,false,false],
  ['Mica Desk Organiser','mica-desk-organiser','Lifestyle',1950,'photo-1707413463619-8f4926d225ba','A compact catch-all tray in hand-finished natural stone.','Kota stone',4.7,7,17,false,false],
  ['Dune Floor Lamp','dune-floor-lamp','Lighting',22400,'photo-1637084745475-868bfbc4ac39','A slender floor lamp with a linen shade for a gentler evening.','Ash wood · linen',4.9,20,4,false,true],
  ['Bela Cotton Cushion','bela-cotton-cushion','Decor',2350,'photo-1616486338812-3dadae4b4ace','A quiet block print on a soft cotton cover with a feather-free insert.','Cotton · removable cover',4.6,13,33,false,false],
]

export const products = rawProducts.map((r,i) => ({ id:`NV-${String(i+1).padStart(3,'0')}`,name:r[0],slug:r[1],category:r[2],price:r[3],image:photo(r[4]),images:[photo(r[4],1200)],description:r[5],material:r[6],rating:r[7],reviewCount:r[8],stock:r[9],featured:r[10],bestseller:r[11],badge:r[11]?'Nivora favourite':i===1?'Small batch':'',sku:`NIV-${String(i+1).padStart(4,'0')}`,status:'Active',compareAtPrice:null,specifications:{Material:r[6],Care:'Wipe gently with a soft, dry cloth',Origin:'Designed in India'}}))

export const orders = [
 {id:'NV-10482',customer:'Meera S.',date:'24 Oct 2026',total:15740,status:'Preparing',payment:'Pending'},
 {id:'NV-10481',customer:'Arjun K.',date:'23 Oct 2026',total:8490,status:'Delivered',payment:'Demo paid'},
 {id:'NV-10480',customer:'Nisha R.',date:'22 Oct 2026',total:18900,status:'Pending',payment:'Pending'},
 {id:'NV-10479',customer:'Kabir D.',date:'20 Oct 2026',total:4890,status:'Delivered',payment:'Demo paid'},
 {id:'NV-10478',customer:'Tara M.',date:'19 Oct 2026',total:11350,status:'Preparing',payment:'Pending'},
].map((o,i)=>({...o,items:[{name:products[i].name,qty:1,price:products[i].price}],shipping:150}))

export const users = [
 {id:'U-001',name:'Meera Sharma',email:'meera@example.com',joined:'12 Sep 2026',role:'Customer',status:'Active'},
 {id:'U-002',name:'Arjun Kapoor',email:'arjun@example.com',joined:'02 Aug 2026',role:'Customer',status:'Active'},
 {id:'U-003',name:'Nisha Rao',email:'nisha@example.com',joined:'17 Jul 2026',role:'Customer',status:'Active'},
 {id:'U-004',name:'Kabir Das',email:'kabir@example.com',joined:'29 Jun 2026',role:'Customer',status:'Active'},
]

export const coupons = [
 {id:'C-01',code:'NIVORA10',type:'Percentage',value:'10%',expiry:'31 Dec 2026',minimum:2500,status:'Active'},
 {id:'C-02',code:'WELCOME500',type:'Fixed amount',value:'₹500',expiry:'30 Nov 2026',minimum:5000,status:'Active'},
 {id:'C-03',code:'SLOWHOME',type:'Percentage',value:'15%',expiry:'15 Sep 2026',minimum:8000,status:'Inactive'},
]
