import React, { useState, useMemo, useCallback } from 'react';
import { SeatSection, VenueEvent } from '../../types';
import { CHARROS_ZONES, CHARROS_SVG_ZONE_MAP, getZonePrice } from '../../lib/seatMap';
import { useStadiumPanZoom, StadiumRegionPreset } from './useStadiumPanZoom';
import { StadiumZoomToolbar } from './StadiumZoomToolbar';
import { useTheme } from '../../context/ThemeContext';
import { Info, Move } from 'lucide-react';

const CHARROS_PRESETS: StadiumRegionPreset[] = [
  { id: 'all', label: 'Todo el Estadio', shortLabel: 'Estadio', icon: '🏟️', normX: 0.5, normY: 0.5, scale: 1 },
  { id: 'home', label: 'Home Plate / VIP / Premier', shortLabel: 'Home / VIP', icon: '⚾', normX: 0.50, normY: 0.76, scale: 2.1 },
  { id: 'first_base', label: 'Lateral 1ra Base (Der)', shortLabel: '1ra Base', icon: '1️⃣', normX: 0.74, normY: 0.60, scale: 2.0 },
  { id: 'third_base', label: 'Lateral 3ra Base (Izq)', shortLabel: '3ra Base', icon: '3️⃣', normX: 0.26, normY: 0.60, scale: 2.0 },
  { id: 'outfield', label: 'Jardines & Bleachers', shortLabel: 'Jardines', icon: '🌳', normX: 0.50, normY: 0.24, scale: 1.9 },
  { id: 'upper', label: 'Planta Alta & Suites', shortLabel: 'Planta Alta', icon: '🏢', normX: 0.50, normY: 0.86, scale: 1.85 },
];

export const CHARROS_BLOCK_LABELS = [
  // Jardín / Esquinas (gray-01 a gray-14)
  { id: 'gray-01', label: 'G1', pts: '266.0,544.5 280.5,565.5 281.0,568.5 256.5,586.5 253.5,587.0 237.5,563.5 237.5,561.5 263.5,544.5' },
  { id: 'gray-02', label: 'G2', pts: '894.5,544.0 923.0,561.5 906.5,587.0 904.0,587.0 878.5,568.0' },
  { id: 'gray-03', label: 'G3', pts: '247.5,518.0 260.5,538.5 234.5,555.5 232.5,555.5 215.0,531.0 215.0,529.0' },
  { id: 'gray-04', label: 'G4', pts: '913.0,517.5 945.0,529.0 928.5,555.0 925.0,554.5 899.5,538.5' },
  { id: 'gray-05', label: 'G5', pts: '210.0,478.0 247.5,482.0 246.0,501.5 207.5,502.0' },
  { id: 'gray-06', label: 'G6', pts: '951.0,478.5 953.0,502.0 914.0,501.0 912.5,482.5 948.0,477.5' },
  { id: 'gray-07', label: 'G7', pts: '215.0,435.5 253.0,442.0 248.5,474.5 211.0,470.0' },
  { id: 'gray-08', label: 'G8', pts: '945.5,435.0 949.5,469.5 912.0,474.5 907.5,441.0' },
  { id: 'gray-09', label: 'G9', pts: '940.0,390.0 944.5,427.5 906.5,433.0 901.5,394.5' },
  { id: 'gray-10', label: 'G10', pts: '220.0,390.0 259.0,395.0 254.0,433.5 215.5,427.0' },
  { id: 'gray-11', label: 'G11', pts: '226.0,344.5 264.0,352.5 259.5,387.0 221.5,382.0' },
  { id: 'gray-12', label: 'G12', pts: '934.0,344.0 939.0,381.5 901.0,387.0 896.5,352.0' },
  { id: 'gray-13', label: 'G13', pts: '229.5,312.0 232.0,311.5 267.0,321.0 268.0,324.0 265.0,344.0 227.5,337.0' },
  { id: 'gray-14', label: 'G14', pts: '930.5,311.0 933.0,337.0 899.0,344.0 895.0,343.5 893.0,321.5' },

  // Premier (premier-01 a premier-08)
  { id: 'premier-01', label: 'PR1', pts: '721.5,584.5 733.5,595.0 732.0,600.5 714.5,611.5 706.5,614.5 696.5,604.0 696.0,600.0 716.5,585.0' },
  { id: 'premier-02', label: 'PR2', pts: '425.0,589.5 435.5,582.5 440.5,582.0 458.0,593.5 460.0,598.0 449.5,611.0 447.5,611.0 431.0,602.0 423.5,594.5' },
  { id: 'premier-03', label: 'PR3', pts: '759.5,553.5 762.5,557.0 762.5,560.0 746.0,583.5 741.0,585.5 734.0,583.0 731.0,579.5 731.5,573.5 747.0,553.5 751.5,550.0' },
  { id: 'premier-04', label: 'PR4', pts: '399.0,553.0 408.5,549.5 426.5,572.0 427.5,577.5 422.5,584.0 416.5,585.0 408.0,577.5 396.0,561.0 395.5,557.0' },
  { id: 'premier-05', label: 'PR5', pts: '782.5,519.5 788.0,525.0 786.5,531.0 770.5,550.5 765.5,550.5 757.5,543.0 759.5,537.0 774.5,518.5' },
  { id: 'premier-06', label: 'PR6', pts: '380.5,517.0 384.0,517.0 389.5,522.0 400.5,539.0 400.0,545.0 393.0,551.0 389.5,551.0 370.5,527.0 371.0,524.0' },
  { id: 'premier-07', label: 'PR7', pts: '814.5,490.0 810.5,499.0 798.0,515.5 791.5,517.5 782.5,511.5 784.0,505.5 799.0,487.0 806.0,487.0' },
  { id: 'premier-08', label: 'PR8', pts: '348.0,488.0 359.0,486.0 362.5,489.0 375.5,506.0 376.0,511.0 372.5,515.5 364.5,517.5 358.5,512.5 345.5,493.5 345.5,490.5' },

  // Lateral Base (magenta-01 a magenta-06)
  { id: 'magenta-01', label: 'M1', pts: '907.0,502.0 900.0,501.5 836.0,483.5 833.5,464.5 839.0,462.5 889.5,455.0 901.0,454.5 903.0,459.5' },
  { id: 'magenta-02', label: 'M2', pts: '253.5,500.0 258.0,458.0 259.5,454.5 312.0,461.0 327.0,465.0 326.0,477.5 323.5,483.0 261.0,500.0' },
  { id: 'magenta-03', label: 'M3', pts: '894.5,397.0 900.0,437.0 899.5,445.0 838.5,454.5 832.0,454.0 827.0,419.5 827.0,407.0 886.5,397.0' },
  { id: 'magenta-04', label: 'M4', pts: '266.0,397.5 273.5,397.0 333.0,407.0 333.5,415.5 328.0,454.0 315.0,453.5 261.0,445.0 260.5,437.0' },
  { id: 'magenta-05', label: 'M5', pts: '885.5,326.5 893.5,386.5 888.5,388.5 825.5,398.0 823.5,393.0 823.0,381.0 881.0,328.5' },
  { id: 'magenta-06', label: 'M6', pts: '275.0,326.0 278.0,327.0 336.0,379.0 337.0,387.5 334.5,397.5 300.0,393.0 267.5,386.5' },

  // Palco Esquina (purple-01 a purple-02)
  { id: 'purple-01', label: 'PE1', pts: '833.0,497.5 852.5,501.0 904.5,516.0 898.5,527.0 873.0,562.5 870.5,562.5 816.5,521.0 817.0,518.0 825.0,506.5' },
  { id: 'purple-02', label: 'PE2', pts: '327.5,498.0 340.5,514.5 343.5,520.5 290.5,561.5 286.5,562.5 261.0,526.5 256.0,517.0 263.5,513.5 315.0,499.5' },

  // Lateral Premier (orange-01 a orange-10)
  { id: 'orange-01', label: 'LP1', pts: '440.0,616.5 446.5,618.0 456.5,626.5 450.5,637.5 443.0,645.5 433.5,641.5 425.0,634.0 428.0,628.5' },
  { id: 'orange-02', label: 'LP2', pts: '719.5,619.5 731.0,632.5 731.0,636.5 722.0,643.5 717.0,644.5 708.0,635.5 705.5,627.0 713.0,621.5' },
  { id: 'orange-03', label: 'LP3', pts: '417.0,599.5 427.5,605.5 431.0,610.5 419.0,626.5 415.0,628.0 398.5,617.5 396.5,614.0 412.5,600.5' },
  { id: 'orange-04', label: 'LP4', pts: '741.0,603.0 745.5,604.5 759.5,615.5 759.5,619.0 744.0,629.5 741.0,629.0 728.0,614.0 730.5,608.5' },
  { id: 'orange-05', label: 'LP5', pts: '812.5,455.0 815.5,456.5 816.5,459.5 817.5,477.5 809.5,479.0 806.5,478.0 803.5,473.5 803.0,457.5 806.0,455.5' },
  { id: 'orange-06', label: 'LP6', pts: '357.0,455.0 359.0,458.5 357.0,473.0 354.0,476.5 346.5,478.5 344.0,475.0 346.0,456.5 350.0,453.5' },
  { id: 'orange-07', label: 'LP7', pts: '810.0,423.5 812.0,427.0 813.5,442.5 810.5,446.0 804.0,447.0 801.5,445.5 800.0,442.0 799.0,425.5 803.0,423.5' },
  { id: 'orange-08', label: 'LP8', pts: '360.0,423.5 362.0,425.0 362.0,441.0 359.0,445.0 350.5,444.5 348.0,441.5 350.0,425.0 353.0,423.0' },
  { id: 'orange-09', label: 'LP9', pts: '806.0,392.0 808.0,396.0 809.0,411.0 806.0,414.0 798.5,414.0 796.0,399.0 801.0,394.0' },
  { id: 'orange-10', label: 'LP10', pts: '355.0,391.5 361.0,393.0 365.5,399.5 365.5,409.0 362.5,414.0 357.5,414.0 352.5,411.0 353.0,397.5' },

  // Butaca Preferente (yellow-01 a yellow-24)
  { id: 'yellow-01', label: 'BP1', pts: '349.0,526.5 362.0,539.0 367.0,549.5 361.5,556.0 352.5,563.0 347.0,564.0 336.0,551.0 331.0,543.0 331.0,540.0 337.0,533.0' },
  { id: 'yellow-02', label: 'BP2', pts: '812.0,527.0 823.0,534.5 828.5,540.5 827.0,546.5 817.0,561.0 811.0,564.0 808.0,563.5 797.0,556.0 793.5,549.5 798.5,539.0 808.0,528.5' },
  { id: 'yellow-03', label: 'BP3', pts: '370.5,557.0 373.5,557.0 377.0,560.0 387.0,572.5 401.5,594.5 401.5,598.0 399.0,602.0 386.5,611.0 384.0,611.0 376.0,603.0 354.5,572.0 356.0,568.0' },
  { id: 'yellow-04', label: 'BP4', pts: '791.0,558.5 803.5,567.5 806.0,571.5 794.0,590.5 779.0,608.5 773.5,613.0 760.0,604.5 755.5,599.0 756.0,595.5 782.0,561.0 785.5,558.0' },
  { id: 'yellow-07', label: '7', pts: '366.0,626.0 371.0,633.5 383.0,625.0 377.5,618.0' },
  { id: 'yellow-08', label: '8', pts: '781.5,618.0 776.0,625.0 788.0,633.5 793.0,626.0' },
  { id: 'yellow-09', label: '9', pts: '359.5,617.5 365.0,625.0 376.5,616.5 371.5,609.0' },
  { id: 'yellow-10', label: '10', pts: '787.5,609.0 782.5,616.5 794.0,625.0 799.5,617.5' },
  { id: 'yellow-11', label: '11', pts: '352.5,608.0 358.0,615.0 369.5,607.0 364.5,599.5' },
  { id: 'yellow-12', label: '12', pts: '794.5,599.5 789.5,607.0 801.0,615.0 806.5,608.0' },
  { id: 'yellow-13', label: '13', pts: '346.5,599.0 351.5,606.5 363.5,598.0 358.0,590.5' },
  { id: 'yellow-14', label: '14', pts: '801.0,590.5 795.5,598.0 807.5,606.5 812.5,599.0' },
  { id: 'yellow-15', label: '15', pts: '339.5,590.0 344.5,597.0 356.5,588.5 351.0,581.5' },
  { id: 'yellow-16', label: '16', pts: '808.0,581.5 802.5,588.5 814.5,597.0 819.5,590.0' },
  { id: 'yellow-17', label: '17', pts: '333.0,580.5 338.0,588.0 350.0,579.5 344.5,572.0' },
  { id: 'yellow-18', label: '18', pts: '814.5,572.0 809.0,579.5 821.0,588.0 826.0,580.5' },
  { id: 'yellow-19', label: '19', pts: '326.0,571.0 331.0,578.0 343.0,569.5 337.5,562.5' },
  { id: 'yellow-20', label: '20', pts: '821.5,562.5 816.0,569.5 828.0,578.0 833.0,571.0' },
  { id: 'yellow-21', label: '21', pts: '319.5,562.0 324.5,569.5 336.5,561.0 331.0,553.5' },
  { id: 'yellow-22', label: '22', pts: '828.0,553.5 822.5,561.0 834.5,569.5 839.5,562.0' },
  { id: 'yellow-23', label: '23', pts: '312.5,552.5 318.0,560.0 330.0,551.5 324.5,544.5' },
  { id: 'yellow-24', label: '24', pts: '834.5,544.5 829.0,551.5 841.0,560.0 846.5,552.5' },

  // VIP / Local / Visitante (cyan, vip, teal)
  { id: 'cyan-01', label: 'C1', pts: '615.0,732.0 617.5,737.5 618.5,759.5 609.5,762.0 586.5,762.0 585.0,755.5 585.5,734.5 587.0,733.0' },
  { id: 'cyan-02', label: 'C2', pts: '540.5,734.0 543.0,731.5 575.0,734.0 574.5,761.0 572.0,762.5 554.5,762.5 539.0,760.0 538.0,753.0' },
  { id: 'cyan-03', label: 'C3', pts: '644.0,729.0 646.0,732.5 648.5,750.0 648.0,756.5 644.0,758.5 632.5,759.0 629.0,754.0 628.0,733.0 632.0,730.0' },
  { id: 'cyan-04', label: 'C4', pts: '513.0,728.5 526.0,729.5 529.5,732.5 527.5,756.0 525.0,758.5 514.5,758.5 508.5,756.0 508.0,750.0 510.5,733.0' },
  { id: 'cyan-05', label: 'C5', pts: '671.0,652.5 679.0,664.0 680.5,671.0 671.5,677.5 664.5,679.0 655.0,667.0 653.5,662.5 665.0,653.5' },
  { id: 'cyan-06', label: 'C6', pts: '492.5,651.0 504.5,659.0 504.5,664.0 494.5,677.5 489.5,677.5 481.5,672.0 478.0,666.0 486.5,654.5' },
  { id: 'cyan-07', label: 'C7', pts: '694.5,636.5 704.5,648.0 705.0,654.0 695.0,661.0 690.5,661.5 687.5,659.5 683.0,652.5 680.0,645.0 690.0,637.0' },
  { id: 'cyan-08', label: 'C8', pts: '464.5,635.0 472.0,637.0 479.5,643.0 479.5,647.0 467.5,660.5 460.5,658.0 453.0,651.5 454.5,647.0' },
  { id: 'vip-01', label: 'V1', pts: '654.5,681.0 654.0,683.0 628.5,683.5 621.5,682.0 621.5,680.5 641.5,667.0 646.0,668.5' },
  { id: 'vip-02', label: 'V2', pts: '505.0,678.0 514.0,666.5 517.0,665.5 535.0,676.5 539.5,682.0 534.0,683.5 505.0,683.0' },
  { id: 'vip-03', label: 'V3', pts: '594.5,663.5 597.0,675.0 597.0,682.0 593.5,683.5 583.5,682.0 582.5,679.5 583.0,664.5' },
  { id: 'vip-04', label: 'V4', pts: '576.0,664.0 576.5,681.5 573.5,683.0 562.5,682.0 561.5,679.0 564.5,664.5 568.5,663.0' },
  { id: 'vip-05', label: 'V5', pts: '610.0,659.0 615.5,666.0 617.5,673.0 610.5,678.5 605.0,680.0 602.5,663.0 605.5,660.0' },
  { id: 'vip-06', label: 'V6', pts: '549.0,657.5 553.0,658.0 557.5,661.5 556.0,673.0 554.0,678.0 548.0,676.0 542.0,671.5 542.0,668.5' },
  { id: 'vip-07', label: 'V7', pts: '625.5,649.5 633.0,658.0 634.5,662.5 624.0,668.5 620.0,664.0 616.5,654.5 621.0,650.5' },
  { id: 'vip-08', label: 'V8', pts: '536.5,648.0 543.0,653.0 543.0,655.5 537.5,665.0 533.5,666.5 527.0,663.0 525.0,659.5 534.5,648.0' },
  { id: 'teal-01', label: 'VIP', pts: '664.5,693.0 663.0,700.0 502.0,700.5 498.5,698.5 498.5,691.0 502.5,689.5 663.0,690.0' },

  // Planta Baja (steel-01 a steel-10)
  { id: 'steel-01', label: 'PB1', pts: '690.5,721.0 695.0,741.0 695.5,751.5 681.0,755.0 659.5,757.5 655.5,740.5 655.0,727.0 657.0,725.5' },
  { id: 'steel-02', label: 'PB2', pts: '468.0,720.5 497.5,724.5 502.0,728.5 497.5,757.0 473.0,754.0 462.5,751.0 463.5,738.5' },
  { id: 'steel-03', label: 'PB3', pts: '732.5,712.0 736.0,721.5 739.0,742.0 710.5,749.0 705.0,749.0 700.5,733.0 699.0,719.5 705.0,716.5 729.0,711.5' },
  { id: 'steel-04', label: 'PB4', pts: '426.5,711.5 459.0,718.0 459.0,725.5 453.0,749.0 437.5,746.5 419.5,741.0 419.0,737.0 423.5,717.5' },
  { id: 'steel-05', label: 'PB5', pts: '772.0,701.0 774.5,704.5 780.5,728.0 777.5,730.5 767.0,734.0 748.0,738.0 740.5,710.0 742.0,708.5' },
  { id: 'steel-06', label: 'PB6', pts: '386.5,700.5 391.5,700.5 418.0,709.0 412.5,734.5 410.0,738.0 382.5,731.0 378.0,727.0 381.0,713.5' },
  { id: 'steel-07', label: 'PB7', pts: '816.0,686.5 818.5,689.5 825.0,710.5 799.5,722.5 788.5,724.0 783.5,711.0 781.0,698.5 784.5,696.0 807.0,688.0' },
  { id: 'steel-08', label: 'PB8', pts: '343.0,685.0 355.5,688.0 377.5,697.0 375.0,710.5 370.0,724.0 360.5,723.0 333.0,711.0 333.0,708.0' },
  { id: 'steel-09', label: 'PB9', pts: '857.5,668.0 867.5,685.0 868.0,689.5 843.0,703.5 833.5,706.5 824.5,686.5 824.0,682.0' },
  { id: 'steel-10', label: 'PB10', pts: '303.5,668.0 329.5,678.0 335.0,681.5 324.5,707.5 316.5,705.0 292.5,691.5 294.0,685.0' },

  // Planta Alta y Suites (navy-01 a navy-43)
  { id: 'navy-01', label: '1', pts: '337.5,736.0 351.0,741.5 346.5,752.0 333.5,747.0' },
  { id: 'navy-02', label: '2', pts: '355.0,743.5 368.5,748.5 368.0,753.0 365.0,759.0 359.0,758.0 351.0,754.0' },
  { id: 'navy-03', label: '3', pts: '804.5,745.5 808.5,756.5 794.0,761.0 791.0,754.0 791.0,749.5 801.0,745.5' },
  { id: 'navy-04', label: '4', pts: '372.5,750.0 386.5,755.0 383.5,766.0 369.5,761.5 370.0,756.0' },
  { id: 'navy-05', label: '5', pts: '786.5,751.5 790.0,763.0 780.0,767.0 775.0,767.5 773.0,763.0 772.5,756.5 774.0,755.0' },
  { id: 'navy-06', label: '6', pts: '390.5,757.0 394.0,757.0 405.5,761.0 403.0,771.5 399.0,772.0 387.5,768.0' },
  { id: 'navy-07', label: '7', pts: '768.0,758.0 771.0,769.5 756.0,773.5 753.0,766.0 753.0,762.5' },
  { id: 'navy-08', label: '8', pts: '335.0,762.0 359.0,771.5 359.0,775.0 348.0,801.0 344.0,800.0 324.5,787.0 326.0,781.0' },
  { id: 'navy-09', label: '9', pts: '409.0,762.0 424.0,766.0 421.5,778.0 406.5,774.0' },
  { id: 'navy-10', label: '10', pts: '749.0,763.5 751.5,775.5 735.5,779.5 733.5,767.5' },
  { id: 'navy-11', label: '11', pts: '428.0,768.0 443.5,771.0 443.0,778.5 441.0,782.5 425.5,779.0' },
  { id: 'navy-12', label: '12', pts: '729.0,769.0 731.0,780.5 716.0,784.0 714.0,779.0 713.5,772.0' },
  { id: 'navy-13', label: '13', pts: '447.0,772.0 463.0,775.0 462.0,787.0 445.0,784.0' },
  { id: 'navy-14', label: '14', pts: '710.0,773.0 712.0,785.0 695.5,788.0 694.0,783.0 694.5,776.0' },
  { id: 'navy-15', label: '15', pts: '368.0,775.5 373.5,776.0 394.0,783.5 382.0,820.5 375.0,818.0 356.0,807.0 357.0,801.0' },
  { id: 'navy-16', label: '16', pts: '467.5,776.5 484.0,779.0 482.5,791.0 466.0,788.0' },
  { id: 'navy-17', label: '17', pts: '794.0,775.5 801.0,791.5 806.0,807.5 787.5,818.0 780.0,820.5 768.0,784.0 786.5,777.0' },
  { id: 'navy-18', label: '18', pts: '689.5,777.0 691.0,789.0 674.5,791.0 673.5,779.5' },
  { id: 'navy-19', label: '19', pts: '488.0,779.5 504.0,781.5 503.5,793.0 487.0,792.0' },
  { id: 'navy-20', label: '20', pts: '670.0,781.0 671.0,792.0 654.5,794.0 653.5,782.5 664.5,780.5' },
  { id: 'navy-21', label: '21', pts: '508.0,782.5 525.0,784.0 524.0,796.0 507.5,794.5' },
  { id: 'navy-22', label: '22', pts: '649.0,783.0 650.0,795.0 633.0,796.0 632.5,784.0' },
  { id: 'navy-23', label: '23', pts: '528.5,785.0 545.0,785.5 545.0,798.0 528.0,797.0' },
  { id: 'navy-24', label: '24', pts: '629.0,785.0 629.0,797.0 612.0,797.5 612.0,786.0' },
  { id: 'navy-25', label: '25', pts: '566.5,787.0 566.0,798.5 554.5,799.0 548.5,797.5 549.5,786.0' },
  { id: 'navy-26', label: '26', pts: '608.0,786.0 608.5,798.0 591.0,799.0 591.0,787.0' },
  { id: 'navy-27', label: '27', pts: '402.5,786.5 428.5,793.0 428.0,799.5 418.0,837.0 408.0,834.0 390.0,825.0 396.0,803.5' },
  { id: 'navy-28', label: '28', pts: '587.0,787.0 586.5,799.0 570.0,799.0 570.0,787.0' },
  { id: 'navy-29', label: '29', pts: '759.5,787.0 772.0,825.0 754.0,834.0 744.0,837.0 736.5,811.5 733.0,793.5 751.5,788.0' },
  { id: 'navy-30', label: '30', pts: '438.0,795.5 464.5,801.0 456.0,851.0 426.5,841.0 431.0,818.5' },
  { id: 'navy-31', label: '31', pts: '724.0,796.0 735.5,840.0 717.5,848.0 705.5,851.0 697.0,801.0' },
  { id: 'navy-32', label: '32', pts: '473.5,802.5 498.5,806.0 500.0,807.5 493.5,860.5 475.0,857.0 464.5,853.5' },
  { id: 'navy-33', label: '33', pts: '688.0,803.0 697.0,853.5 668.5,860.5 662.0,807.0 668.5,805.0' },
  { id: 'navy-34', label: '34', pts: '509.0,807.5 530.0,809.0 535.5,811.0 532.0,867.0 520.5,866.0 502.0,862.0 507.0,816.0' },
  { id: 'navy-35', label: '35', pts: '652.5,807.5 655.0,818.5 659.5,862.5 636.5,867.0 630.0,867.0 626.0,810.0' },
  { id: 'navy-36', label: '36', pts: '544.0,811.0 576.0,811.5 576.0,870.5 541.0,868.0' },
  { id: 'navy-37', label: '37', pts: '617.0,810.5 621.0,868.0 607.0,870.0 585.0,870.5 584.0,868.0 584.5,812.0' },
  { id: 'navy-38', label: '38', pts: '269.0,727.0 273.0,728.0 293.0,740.5 286.5,757.0 276.5,750.5 262.5,737.0' },
  { id: 'navy-39', label: '39', pts: '894.0,727.0 899.0,734.5 899.5,737.5 884.5,752.0 876.0,757.5 869.0,743.5 869.0,741.0 891.0,727.5' },
  { id: 'navy-40', label: '40', pts: '300.5,745.5 326.5,757.5 326.5,760.5 317.5,781.0 308.0,775.5 293.5,764.0' },
  { id: 'navy-41', label: '41', pts: '861.5,746.5 868.0,760.5 868.5,764.5 849.0,780.0 845.0,781.0 836.0,762.0 835.5,758.0 858.5,746.5' },
  { id: 'navy-42', label: '42', pts: '827.5,762.5 838.0,785.5 838.0,788.0 814.0,802.5 802.5,772.0' },
  { id: 'navy-43', label: '43', pts: '825.5,747.0 812.5,752.0 808.0,741.5 821.5,736.0' },
];

export interface CharrosStadiumMapProps {
  sections?: SeatSection[];
  activeSectionNumber?: string;
  activeZoneFilter?: string | null;
  onSelectSection: (sectionNumber: string, zoneName?: string) => void;
  event?: VenueEvent | null;
  soldOutSectionsSet?: Set<string>;
  highlightOnlyActiveSection?: boolean;
}

export const CharrosStadiumMap: React.FC<CharrosStadiumMapProps> = ({
  sections = [],
  activeSectionNumber = '',
  activeZoneFilter = null,
  onSelectSection,
  event = null,
  soldOutSectionsSet,
  highlightOnlyActiveSection = false,
}) => {
  const { theme } = useTheme();
  const [hoveredInfo, setHoveredInfo] = useState<{ id: string; zone: string } | null>(null);
  const [showZoneGuide, setShowZoneGuide] = useState<boolean>(false);

  const {
    scale,
    isDragging,
    hasMovedRef,
    containerRef,
    activeRegionId,
    zoomToRegion,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleDoubleClick,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    transformStyle,
  } = useStadiumPanZoom({ minScale: 0.75, maxScale: 3.8 });

  // Manejador por delegación de eventos para los polígonos interactivos
  const handleBloquesClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // Si el usuario estaba arrastrando/paneando el mapa, evitar disparar selección accidental
      if (hasMovedRef.current) return;

      const polygon = (e.target as Element).closest('polygon.blk');
      if (!polygon) return;
      const secId = polygon.id;
      const zoneKey = polygon.getAttribute('data-zone') || '';
      const zoneName = CHARROS_SVG_ZONE_MAP[zoneKey] || zoneKey;
      const zoneMeta = CHARROS_ZONES[zoneName];

      const hasAssignedPrice = event && event.priceTiers && event.priceTiers.length > 0
        ? event.priceTiers.some((t) => t.section.trim().toLowerCase() === (zoneMeta?.name || zoneName).trim().toLowerCase() && t.price > 0)
        : (zoneMeta && zoneMeta.defaultPrice > 0);

      if (!hasAssignedPrice) {
        return;
      }

      if (secId) {
        onSelectSection(secId, zoneMeta ? zoneMeta.name : zoneName);
      }
    },
    [event, onSelectSection, hasMovedRef]
  );

  const handleBloquesMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setHoveredInfo(null);
      return;
    }
    const polygon = (e.target as Element).closest('polygon.blk');
    if (!polygon) {
      setHoveredInfo(null);
      return;
    }
    const id = polygon.id;
    const zone = polygon.getAttribute('data-zone') || '';
    setHoveredInfo({ id, zone });
  }, [isDragging]);

  const handleBloquesMouseLeave = useCallback(() => {
    setHoveredInfo(null);
  }, []);

  // Metadatos de la sección o zona activa
  const activeZoneMeta = useMemo(() => {
    if (!activeSectionNumber) return null;
    const directMeta = Object.values(CHARROS_ZONES).find(
      (z) => z.name.toLowerCase() === activeSectionNumber.toLowerCase()
    );
    if (directMeta) return directMeta;

    const prefix = activeSectionNumber.split('-')[0];
    const zoneName = CHARROS_SVG_ZONE_MAP[prefix] || CHARROS_SVG_ZONE_MAP[activeSectionNumber];
    if (zoneName && CHARROS_ZONES[zoneName]) {
      return CHARROS_ZONES[zoneName];
    }
    return null;
  }, [activeSectionNumber]);

  return (
    <div className="space-y-2.5">
      {/* Estilos dinámicos para el mapa SVG */}
      <style>{`
        .blk {
          cursor: pointer;
          transition: fill 0.18s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.18s ease, filter 0.18s ease, opacity 0.18s ease;
          stroke: rgba(255, 255, 255, 0.7);
          stroke-width: 1px;
          stroke-linejoin: round;
        }
        .blk:hover {
          filter: brightness(1.2) drop-shadow(0 3px 8px rgba(0, 0, 0, 0.45)) !important;
          stroke: #0f172a !important;
          stroke-width: 2.2px !important;
        }
        .no-vendible {
          pointer-events: none;
        }
        ${hoveredInfo?.id ? `
          #${hoveredInfo.id} {
            stroke: #0f172a !important;
            stroke-width: 2.4px !important;
            filter: brightness(1.22) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.45)) !important;
          }
        ` : ''}
        ${activeSectionNumber ? `
          #${activeSectionNumber}, [data-zone="${activeSectionNumber}"] {
            stroke: #d97706 !important;
            stroke-width: 3.2px !important;
            filter: drop-shadow(0 0 10px rgba(217, 119, 6, 0.95)) !important;
          }
        ` : ''}
      `}</style>

      {/* Indicador de sección y zona activa */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          {activeSectionNumber ? (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black shadow-xs border ${
              theme === 'light'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Sección: {activeSectionNumber}
            </span>
          ) : (
            <span className={`text-xs font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Toca cualquier sección para ver butacas
            </span>
          )}

          {activeZoneMeta && (
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${activeZoneMeta.badgeBg}`}>
              {activeZoneMeta.name} • ${getZonePrice(activeZoneMeta.name, event)} MXN
            </span>
          )}
        </div>
      </div>

      {/* Barra de herramientas con selector de áreas y zoom focal */}
      <StadiumZoomToolbar
        scale={scale}
        presets={CHARROS_PRESETS}
        activeRegionId={activeRegionId}
        onSelectPreset={(preset) => zoomToRegion(preset.normX, preset.normY, preset.scale, preset.id)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleResetZoom}
        showZoneGuide={showZoneGuide}
        onToggleZoneGuide={() => setShowZoneGuide(!showZoneGuide)}
        hintText="Estadio Panamericano Charros de Jalisco"
      />

      {/* Contenedor interactivo del SVG con Pan & Zoom focal a cualquier parte */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        className={`relative w-full rounded-2xl p-2 sm:p-4 border shadow-xl overflow-hidden select-none touch-none transition-colors ${
          theme === 'light'
            ? 'bg-[#eef2f6] border-slate-300'
            : 'bg-[#0F1626] border-slate-700'
        } ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        title="Arrastra para mover • Rueda o doble clic en cualquier zona para hacer zoom"
      >
        {/* Banner flotante con información al pasar el cursor */}
        {hoveredInfo && !isDragging && (
          <div className={`absolute top-4 left-4 z-20 pointer-events-none px-3 py-2 rounded-xl border shadow-2xl backdrop-blur-md text-xs animate-in fade-in zoom-in-95 duration-100 ${
            theme === 'light'
              ? 'bg-white/95 border-slate-300 text-slate-900 shadow-slate-400/30'
              : 'bg-slate-900/95 border-slate-700 text-white'
          }`}>
            <div className={`font-black ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`}>
              {hoveredInfo.id}
            </div>
            <div className={`font-medium mt-0.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
              {(() => {
                const zoneName = CHARROS_SVG_ZONE_MAP[hoveredInfo.zone] || hoveredInfo.zone;
                const zoneMeta = CHARROS_ZONES[zoneName];
                if (!zoneMeta || zoneMeta.defaultPrice === 0) {
                  return <span className="text-slate-400 italic">sin precio asignado</span>;
                }
                const price = getZonePrice(zoneMeta.name, event);
                return (
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{zoneMeta.name}</span>
                    <span className={`font-black ${theme === 'light' ? 'text-amber-600' : 'text-amber-400'}`}>${price} MXN</span>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Mini pista visual en la esquina inferior */}
        <div className={`absolute bottom-2.5 right-2.5 z-10 pointer-events-none px-2 py-1 rounded-lg border backdrop-blur-xs text-[10px] font-bold ${
          theme === 'light'
            ? 'bg-white/85 border-slate-300 text-slate-700 shadow-xs'
            : 'bg-slate-900/70 border-slate-700/60 text-slate-300'
        }`}>
          Arrastra para mover • Zoom con rueda/pellizco
        </div>

        <div
          className="w-full flex items-center justify-center max-h-[750px] pointer-events-auto"
          style={transformStyle}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1179 912"
            width="1179"
            height="912"
            className="w-full h-auto max-w-[980px]"
            shapeRendering="geometricPrecision"
            textRendering="geometricPrecision"
            onClick={handleBloquesClick}
            onMouseMove={handleBloquesMouseMove}
            onMouseLeave={handleBloquesMouseLeave}
          >
            <rect id="fondo" width="1179" height="912" fill="#e9eef2" className="no-vendible" />
            <polygon id="contorno-01" className="no-vendible" fill="#ebebeb" stroke="#d8d9dc" strokeWidth="2.5" strokeLinejoin="round" points="568.0,149.0 528.0,153.5 480.0,163.0 432.5,176.5 384.5,195.0 321.0,225.5 299.5,238.5 280.0,275.5 273.5,280.5 204.0,281.0 198.0,284.0 194.0,290.5 175.0,516.5 180.0,524.0 191.0,527.5 196.0,532.0 278.5,658.0 278.5,670.5 240.5,733.5 242.5,742.0 273.5,774.0 306.5,802.0 351.5,833.0 385.5,852.0 430.0,871.5 469.5,884.5 516.5,894.5 554.0,898.5 596.0,899.0 638.5,895.0 684.5,885.5 721.5,874.0 773.0,852.0 813.5,829.0 847.0,806.0 902.0,757.0 915.5,741.0 916.0,730.0 881.0,672.5 879.5,659.0 963.0,531.5 977.5,524.5 982.0,519.5 983.0,511.5 964.5,293.0 959.5,283.5 954.0,281.0 884.0,280.5 876.5,273.0 862.0,242.0 855.0,236.5 791.0,203.0 727.0,177.5 670.5,161.0 638.5,154.5 604.5,150.0" />
            <polygon id="campo-borde-01" className="no-vendible" fill="#ea9b3b" stroke="#ea9b3b" strokeWidth="3" strokeLinejoin="round" points="600.5,217.5 563.5,217.5 537.0,220.5 507.5,227.5 468.0,243.0 434.5,262.5 391.5,295.5 357.0,328.0 349.5,341.5 349.5,351.5 352.5,359.0 382.0,388.5 391.5,402.0 387.5,439.5 387.5,466.0 394.0,484.0 447.0,557.5 463.5,571.5 477.0,577.5 540.5,615.5 544.5,620.0 570.5,630.0 590.0,629.5 607.0,623.5 708.5,559.0 725.5,535.0 727.0,530.0 737.5,519.5 764.5,479.5 769.5,456.5 765.0,402.0 781.5,382.5 801.5,363.5 807.5,349.5 807.0,342.0 802.5,331.5 781.0,310.0 751.0,283.5 715.0,259.5 711.0,255.0 696.0,246.0 655.0,229.0 636.0,224.5 630.5,221.5" />
            <polygon id="campo-pasto-01" className="no-vendible" fill="#81b853" points="600.5,220.0 563.5,220.0 537.0,223.0 507.5,230.0 469.5,245.0 436.0,264.5 393.0,297.5 359.5,329.0 352.0,342.5 352.0,350.5 355.0,358.0 384.5,387.5 394.0,401.0 390.0,440.5 390.0,465.0 396.5,483.0 449.5,556.5 465.0,569.5 478.5,575.5 542.0,613.5 546.0,618.0 570.5,627.5 590.0,627.0 605.5,621.5 706.0,558.0 723.0,534.0 724.5,529.0 735.0,518.5 762.0,478.5 767.0,455.5 762.5,401.0 776.0,384.5 799.0,362.5 805.0,348.5 800.0,332.5 779.5,312.0 749.5,285.5 713.5,261.5 709.5,257.0 694.5,248.0 653.5,231.0 634.0,226.5 630.5,224.0" />
            <polygon id="campo-tierra-01" className="no-vendible" fill="#ea9b3b" points="576.5,335.0 552.5,337.0 521.0,344.5 508.5,349.0 477.0,366.5 472.5,371.5 466.0,373.5 440.5,399.5 438.5,405.0 431.0,412.5 426.5,420.5 423.0,433.0 452.0,461.5 463.0,474.5 468.0,476.5 467.5,473.0 469.5,469.0 475.5,469.5 479.0,472.5 478.5,478.0 472.0,480.0 473.0,484.0 478.5,487.5 488.5,499.5 499.0,508.0 501.5,512.5 535.0,546.0 539.0,548.0 541.0,552.0 559.5,570.5 558.5,579.0 556.0,581.5 556.5,588.5 555.0,592.0 559.5,603.5 569.0,611.0 576.0,613.5 582.5,613.5 589.5,611.0 598.0,603.0 599.0,593.0 602.0,590.5 602.0,582.5 599.5,577.0 599.0,570.0 603.0,564.0 635.5,530.0 643.5,524.0 659.5,506.5 681.5,486.5 685.5,479.5 679.0,479.0 677.5,472.0 681.0,469.0 686.5,469.0 688.5,476.5 694.0,473.5 734.5,432.0 734.5,430.0 722.5,408.5 705.5,388.0 674.0,361.5 665.0,358.5 647.5,348.5 615.0,338.0" />
            <polygon id="campo-infield-01" className="no-vendible" fill="#71b355" points="566.0,381.0 551.0,394.0 489.0,456.0 488.0,464.0 489.5,474.5 488.0,486.5 560.0,558.5 567.0,562.5 575.0,561.0 591.5,562.0 669.5,483.5 667.0,473.5 668.0,457.0 593.0,382.5 573.0,383.0" />
            <g id="lineas-foul" className="no-vendible" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"><line x1="417" y1="413" x2="578" y2="588" /><line x1="741" y1="414" x2="582" y2="588" /></g>
            <polygon id="bleacher-01" className="no-vendible" fill="#c8c8c8" points="746.5,240.5 755.0,244.0 765.5,251.5 792.5,274.5 792.5,278.5 778.5,292.5 774.0,290.5 734.5,259.5 737.0,253.5" />
            <polygon id="bleacher-02" className="no-vendible" fill="#c8c7c7" points="410.0,240.0 422.0,257.5 422.0,260.0 381.5,291.5 379.0,292.0 364.5,278.0 364.0,274.5 397.5,247.0" />

            {/* Jardín / Esquinas (gray) */}
            <g id="zona-gray">
              <polygon id="gray-01" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="266.0,544.5 280.5,565.5 281.0,568.5 256.5,586.5 253.5,587.0 237.5,563.5 237.5,561.5 263.5,544.5" />
              <polygon id="gray-02" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="894.5,544.0 923.0,561.5 906.5,587.0 904.0,587.0 878.5,568.0" />
              <polygon id="gray-03" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="247.5,518.0 260.5,538.5 234.5,555.5 232.5,555.5 215.0,531.0 215.0,529.0" />
              <polygon id="gray-04" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="913.0,517.5 945.0,529.0 928.5,555.0 925.0,554.5 899.5,538.5" />
              <polygon id="gray-05" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="210.0,478.0 247.5,482.0 246.0,501.5 207.5,502.0" />
              <polygon id="gray-06" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="951.0,478.5 953.0,502.0 914.0,501.0 912.5,482.5 948.0,477.5" />
              <polygon id="gray-07" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="215.0,435.5 253.0,442.0 248.5,474.5 211.0,470.0" />
              <polygon id="gray-08" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="945.5,435.0 949.5,469.5 912.0,474.5 907.5,441.0" />
              <polygon id="gray-09" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="940.0,390.0 944.5,427.5 906.5,433.0 901.5,394.5" />
              <polygon id="gray-10" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="220.0,390.0 259.0,395.0 254.0,433.5 215.5,427.0" />
              <polygon id="gray-11" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="226.0,344.5 264.0,352.5 259.5,387.0 221.5,382.0" />
              <polygon id="gray-12" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="934.0,344.0 939.0,381.5 901.0,387.0 896.5,352.0" />
              <polygon id="gray-13" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="229.5,312.0 232.0,311.5 267.0,321.0 268.0,324.0 265.0,344.0 227.5,337.0" />
              <polygon id="gray-14" className="gray blk" data-zone="Jardín / Esquinas" fill="#939393" points="930.5,311.0 933.0,337.0 899.0,344.0 895.0,343.5 893.0,321.5" />
            </g>

            {/* Premier (lime/green) */}
            <g id="zona-premier">
              <polygon id="premier-01" className="premier blk" data-zone="Premier" fill="#96bb4d" points="721.5,584.5 733.5,595.0 732.0,600.5 714.5,611.5 706.5,614.5 696.5,604.0 696.0,600.0 716.5,585.0" />
              <polygon id="premier-02" className="premier blk" data-zone="Premier" fill="#96bb4d" points="425.0,589.5 435.5,582.5 440.5,582.0 458.0,593.5 460.0,598.0 449.5,611.0 447.5,611.0 431.0,602.0 423.5,594.5" />
              <polygon id="premier-03" className="premier blk" data-zone="Premier" fill="#96bb4d" points="759.5,553.5 762.5,557.0 762.5,560.0 746.0,583.5 741.0,585.5 734.0,583.0 731.0,579.5 731.5,573.5 747.0,553.5 751.5,550.0" />
              <polygon id="premier-04" className="premier blk" data-zone="Premier" fill="#96bb4d" points="399.0,553.0 408.5,549.5 426.5,572.0 427.5,577.5 422.5,584.0 416.5,585.0 408.0,577.5 396.0,561.0 395.5,557.0" />
              <polygon id="premier-05" className="premier blk" data-zone="Premier" fill="#96bb4d" points="782.5,519.5 788.0,525.0 786.5,531.0 770.5,550.5 765.5,550.5 757.5,543.0 759.5,537.0 774.5,518.5" />
              <polygon id="premier-06" className="premier blk" data-zone="Premier" fill="#96bb4d" points="380.5,517.0 384.0,517.0 389.5,522.0 400.5,539.0 400.0,545.0 393.0,551.0 389.5,551.0 370.5,527.0 371.0,524.0" />
              <polygon id="premier-07" className="premier blk" data-zone="Premier" fill="#96bb4d" points="814.5,490.0 810.5,499.0 798.0,515.5 791.5,517.5 782.5,511.5 784.0,505.5 799.0,487.0 806.0,487.0" />
              <polygon id="premier-08" className="premier blk" data-zone="Premier" fill="#96bb4d" points="348.0,488.0 359.0,486.0 362.5,489.0 375.5,506.0 376.0,511.0 372.5,515.5 364.5,517.5 358.5,512.5 345.5,493.5 345.5,490.5" />
            </g>

            {/* Lateral Base (magenta) */}
            <g id="zona-magenta">
              <polygon id="magenta-01" className="magenta blk" data-zone="Lateral Base" fill="#d50c79" points="907.0,502.0 900.0,501.5 836.0,483.5 833.5,464.5 839.0,462.5 889.5,455.0 901.0,454.5 903.0,459.5" />
              <polygon id="magenta-02" className="magenta blk" data-zone="Lateral Base" fill="#d50c79" points="253.5,500.0 258.0,458.0 259.5,454.5 312.0,461.0 327.0,465.0 326.0,477.5 323.5,483.0 261.0,500.0" />
              <polygon id="magenta-03" className="magenta blk" data-zone="Lateral Base" fill="#d50c79" points="894.5,397.0 900.0,437.0 899.5,445.0 838.5,454.5 832.0,454.0 827.0,419.5 827.0,407.0 886.5,397.0" />
              <polygon id="magenta-04" className="magenta blk" data-zone="Lateral Base" fill="#d50c79" points="266.0,397.5 273.5,397.0 333.0,407.0 333.5,415.5 328.0,454.0 315.0,453.5 261.0,445.0 260.5,437.0" />
              <polygon id="magenta-05" className="magenta blk" data-zone="Lateral Base" fill="#d50c79" points="885.5,326.5 893.5,386.5 888.5,388.5 825.5,398.0 823.5,393.0 823.0,381.0 881.0,328.5" />
              <polygon id="magenta-06" className="magenta blk" data-zone="Lateral Base" fill="#d50c79" points="275.0,326.0 278.0,327.0 336.0,379.0 337.0,387.5 334.5,397.5 300.0,393.0 267.5,386.5" />
            </g>

            {/* Palco Esquina (purple) */}
            <g id="zona-purple">
              <polygon id="purple-01" className="purple blk" data-zone="Palco Esquina" fill="#753d87" points="833.0,497.5 852.5,501.0 904.5,516.0 898.5,527.0 873.0,562.5 870.5,562.5 816.5,521.0 817.0,518.0 825.0,506.5" />
              <polygon id="purple-02" className="purple blk" data-zone="Palco Esquina" fill="#753d87" points="327.5,498.0 340.5,514.5 343.5,520.5 290.5,561.5 286.5,562.5 261.0,526.5 256.0,517.0 263.5,513.5 315.0,499.5" />
            </g>

            {/* Lateral Premier (orange) */}
            <g id="zona-orange">
              <polygon id="orange-01" className="orange blk" data-zone="Lateral Premier" fill="#e59936" points="440.0,616.5 446.5,618.0 456.5,626.5 450.5,637.5 443.0,645.5 433.5,641.5 425.0,634.0 428.0,628.5" />
              <polygon id="orange-02" className="orange blk" data-zone="Lateral Premier" fill="#e39c3a" points="719.5,619.5 731.0,632.5 731.0,636.5 722.0,643.5 717.0,644.5 708.0,635.5 705.5,627.0 713.0,621.5" />
              <polygon id="orange-03" className="orange blk" data-zone="Lateral Premier" fill="#e79e3e" points="417.0,599.5 427.5,605.5 431.0,610.5 419.0,626.5 415.0,628.0 398.5,617.5 396.5,614.0 412.5,600.5" />
              <polygon id="orange-04" className="orange blk" data-zone="Lateral Premier" fill="#e89a3d" points="741.0,603.0 745.5,604.5 759.5,615.5 759.5,619.0 744.0,629.5 741.0,629.0 728.0,614.0 730.5,608.5" />
              <polygon id="orange-05" className="orange blk" data-zone="Lateral Premier" fill="#e19a40" points="812.5,455.0 815.5,456.5 816.5,459.5 817.5,477.5 809.5,479.0 806.5,478.0 803.5,473.5 803.0,457.5 806.0,455.5" />
              <polygon id="orange-06" className="orange blk" data-zone="Lateral Premier" fill="#dc9c42" points="357.0,455.0 359.0,458.5 357.0,473.0 354.0,476.5 346.5,478.5 344.0,475.0 346.0,456.5 350.0,453.5" />
              <polygon id="orange-07" className="orange blk" data-zone="Lateral Premier" fill="#e2a048" points="810.0,423.5 812.0,427.0 813.5,442.5 810.5,446.0 804.0,447.0 801.5,445.5 800.0,442.0 799.0,425.5 803.0,423.5" />
              <polygon id="orange-08" className="orange blk" data-zone="Lateral Premier" fill="#e09e48" points="360.0,423.5 362.0,425.0 362.0,441.0 359.0,445.0 350.5,444.5 348.0,441.5 350.0,425.0 353.0,423.0" />
              <polygon id="orange-09" className="orange blk" data-zone="Lateral Premier" fill="#db9a47" points="806.0,392.0 808.0,396.0 809.0,411.0 806.0,414.0 798.5,414.0 796.0,399.0 801.0,394.0" />
              <polygon id="orange-10" className="orange blk" data-zone="Lateral Premier" fill="#df9c42" points="355.0,391.5 361.0,393.0 365.5,399.5 365.5,409.0 362.5,414.0 357.5,414.0 352.5,411.0 353.0,397.5" />
            </g>

            {/* Butaca Preferente (yellow) */}
            <g id="zona-yellow">
              <polygon id="yellow-01" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="349.0,526.5 362.0,539.0 367.0,549.5 361.5,556.0 352.5,563.0 347.0,564.0 336.0,551.0 331.0,543.0 331.0,540.0 337.0,533.0" />
              <polygon id="yellow-02" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="812.0,527.0 823.0,534.5 828.5,540.5 827.0,546.5 817.0,561.0 811.0,564.0 808.0,563.5 797.0,556.0 793.5,549.5 798.5,539.0 808.0,528.5" />
              <polygon id="yellow-03" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="370.5,557.0 373.5,557.0 377.0,560.0 387.0,572.5 401.5,594.5 401.5,598.0 399.0,602.0 386.5,611.0 384.0,611.0 376.0,603.0 354.5,572.0 356.0,568.0" />
              <polygon id="yellow-04" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="791.0,558.5 803.5,567.5 806.0,571.5 794.0,590.5 779.0,608.5 773.5,613.0 760.0,604.5 755.5,599.0 756.0,595.5 782.0,561.0 785.5,558.0" />
              <polygon id="yellow-07" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="366.0,626.0 371.0,633.5 383.0,625.0 377.5,618.0" />
              <polygon id="yellow-08" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="781.5,618.0 776.0,625.0 788.0,633.5 793.0,626.0" />
              <polygon id="yellow-09" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="359.5,617.5 365.0,625.0 376.5,616.5 371.5,609.0" />
              <polygon id="yellow-10" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="787.5,609.0 782.5,616.5 794.0,625.0 799.5,617.5" />
              <polygon id="yellow-11" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="352.5,608.0 358.0,615.0 369.5,607.0 364.5,599.5" />
              <polygon id="yellow-12" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="794.5,599.5 789.5,607.0 801.0,615.0 806.5,608.0" />
              <polygon id="yellow-13" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="346.5,599.0 351.5,606.5 363.5,598.0 358.0,590.5" />
              <polygon id="yellow-14" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="801.0,590.5 795.5,598.0 807.5,606.5 812.5,599.0" />
              <polygon id="yellow-15" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="339.5,590.0 344.5,597.0 356.5,588.5 351.0,581.5" />
              <polygon id="yellow-16" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="808.0,581.5 802.5,588.5 814.5,597.0 819.5,590.0" />
              <polygon id="yellow-17" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="333.0,580.5 338.0,588.0 350.0,579.5 344.5,572.0" />
              <polygon id="yellow-18" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="814.5,572.0 809.0,579.5 821.0,588.0 826.0,580.5" />
              <polygon id="yellow-19" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="326.0,571.0 331.0,578.0 343.0,569.5 337.5,562.5" />
              <polygon id="yellow-20" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="821.5,562.5 816.0,569.5 828.0,578.0 833.0,571.0" />
              <polygon id="yellow-21" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="319.5,562.0 324.5,569.5 336.5,561.0 331.0,553.5" />
              <polygon id="yellow-22" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="828.0,553.5 822.5,561.0 834.5,569.5 839.5,562.0" />
              <polygon id="yellow-23" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="312.5,552.5 318.0,560.0 330.0,551.5 324.5,544.5" />
              <polygon id="yellow-24" className="yellow blk" data-zone="Butaca Preferente" fill="#f4e723" points="834.5,544.5 829.0,551.5 841.0,560.0 846.5,552.5" />
            </g>

            {/* VIP / Local / Visitante (cyan + vip + teal) */}
            <g id="zona-cyan">
              <polygon id="cyan-01" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="615.0,732.0 617.5,737.5 618.5,759.5 609.5,762.0 586.5,762.0 585.0,755.5 585.5,734.5 587.0,733.0" />
              <polygon id="cyan-02" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="540.5,734.0 543.0,731.5 575.0,734.0 574.5,761.0 572.0,762.5 554.5,762.5 539.0,760.0 538.0,753.0" />
              <polygon id="cyan-03" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="644.0,729.0 646.0,732.5 648.5,750.0 648.0,756.5 644.0,758.5 632.5,759.0 629.0,754.0 628.0,733.0 632.0,730.0" />
              <polygon id="cyan-04" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="513.0,728.5 526.0,729.5 529.5,732.5 527.5,756.0 525.0,758.5 514.5,758.5 508.5,756.0 508.0,750.0 510.5,733.0" />
              <polygon id="cyan-05" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="671.0,652.5 679.0,664.0 680.5,671.0 671.5,677.5 664.5,679.0 655.0,667.0 653.5,662.5 665.0,653.5" />
              <polygon id="cyan-06" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="492.5,651.0 504.5,659.0 504.5,664.0 494.5,677.5 489.5,677.5 481.5,672.0 478.0,666.0 486.5,654.5" />
              <polygon id="cyan-07" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="694.5,636.5 704.5,648.0 705.0,654.0 695.0,661.0 690.5,661.5 687.5,659.5 683.0,652.5 680.0,645.0 690.0,637.0" />
              <polygon id="cyan-08" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="464.5,635.0 472.0,637.0 479.5,643.0 479.5,647.0 467.5,660.5 460.5,658.0 453.0,651.5 454.5,647.0" />
              <polygon id="vip-01" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="654.5,681.0 654.0,683.0 628.5,683.5 621.5,682.0 621.5,680.5 641.5,667.0 646.0,668.5" />
              <polygon id="vip-02" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="505.0,678.0 514.0,666.5 517.0,665.5 535.0,676.5 539.5,682.0 534.0,683.5 505.0,683.0" />
              <polygon id="vip-03" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="594.5,663.5 597.0,675.0 597.0,682.0 593.5,683.5 583.5,682.0 582.5,679.5 583.0,664.5" />
              <polygon id="vip-04" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="576.0,664.0 576.5,681.5 573.5,683.0 562.5,682.0 561.5,679.0 564.5,664.5 568.5,663.0" />
              <polygon id="vip-05" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="610.0,659.0 615.5,666.0 617.5,673.0 610.5,678.5 605.0,680.0 602.5,663.0 605.5,660.0" />
              <polygon id="vip-06" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="549.0,657.5 553.0,658.0 557.5,661.5 556.0,673.0 554.0,678.0 548.0,676.0 542.0,671.5 542.0,668.5" />
              <polygon id="vip-07" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="625.5,649.5 633.0,658.0 634.5,662.5 624.0,668.5 620.0,664.0 616.5,654.5 621.0,650.5" />
              <polygon id="vip-08" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#1da2d0" points="536.5,648.0 543.0,653.0 543.0,655.5 537.5,665.0 533.5,666.5 527.0,663.0 525.0,659.5 534.5,648.0" />
              <polygon id="teal-01" className="cyan blk" data-zone="VIP / Local / Visitante" fill="#237d7f" points="664.5,693.0 663.0,700.0 502.0,700.5 498.5,698.5 498.5,691.0 502.5,689.5 663.0,690.0" />
            </g>

            {/* Planta Baja (steel) */}
            <g id="zona-steel">
              <polygon id="steel-01" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="690.5,721.0 695.0,741.0 695.5,751.5 681.0,755.0 659.5,757.5 655.5,740.5 655.0,727.0 657.0,725.5" />
              <polygon id="steel-02" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="468.0,720.5 497.5,724.5 502.0,728.5 497.5,757.0 473.0,754.0 462.5,751.0 463.5,738.5" />
              <polygon id="steel-03" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="732.5,712.0 736.0,721.5 739.0,742.0 710.5,749.0 705.0,749.0 700.5,733.0 699.0,719.5 705.0,716.5 729.0,711.5" />
              <polygon id="steel-04" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="426.5,711.5 459.0,718.0 459.0,725.5 453.0,749.0 437.5,746.5 419.5,741.0 419.0,737.0 423.5,717.5" />
              <polygon id="steel-05" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="772.0,701.0 774.5,704.5 780.5,728.0 777.5,730.5 767.0,734.0 748.0,738.0 740.5,710.0 742.0,708.5" />
              <polygon id="steel-06" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="386.5,700.5 391.5,700.5 418.0,709.0 412.5,734.5 410.0,738.0 382.5,731.0 378.0,727.0 381.0,713.5" />
              <polygon id="steel-07" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="816.0,686.5 818.5,689.5 825.0,710.5 799.5,722.5 788.5,724.0 783.5,711.0 781.0,698.5 784.5,696.0 807.0,688.0" />
              <polygon id="steel-08" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="343.0,685.0 355.5,688.0 377.5,697.0 375.0,710.5 370.0,724.0 360.5,723.0 333.0,711.0 333.0,708.0" />
              <polygon id="steel-09" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="857.5,668.0 867.5,685.0 868.0,689.5 843.0,703.5 833.5,706.5 824.5,686.5 824.0,682.0" />
              <polygon id="steel-10" className="steel blk" data-zone="Planta Baja" fill="#3a74a1" points="303.5,668.0 329.5,678.0 335.0,681.5 324.5,707.5 316.5,705.0 292.5,691.5 294.0,685.0" />
            </g>

            {/* Planta Alta y Suites (navy) */}
            <g id="zona-navy">
              <polygon id="navy-01" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="337.5,736.0 351.0,741.5 346.5,752.0 333.5,747.0" />
              <polygon id="navy-02" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="355.0,743.5 368.5,748.5 368.0,753.0 365.0,759.0 359.0,758.0 351.0,754.0" />
              <polygon id="navy-03" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="804.5,745.5 808.5,756.5 794.0,761.0 791.0,754.0 791.0,749.5 801.0,745.5" />
              <polygon id="navy-04" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="372.5,750.0 386.5,755.0 383.5,766.0 369.5,761.5 370.0,756.0" />
              <polygon id="navy-05" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="786.5,751.5 790.0,763.0 780.0,767.0 775.0,767.5 773.0,763.0 772.5,756.5 774.0,755.0" />
              <polygon id="navy-06" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="390.5,757.0 394.0,757.0 405.5,761.0 403.0,771.5 399.0,772.0 387.5,768.0" />
              <polygon id="navy-07" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="768.0,758.0 771.0,769.5 756.0,773.5 753.0,766.0 753.0,762.5" />
              <polygon id="navy-08" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="335.0,762.0 359.0,771.5 359.0,775.0 348.0,801.0 344.0,800.0 324.5,787.0 326.0,781.0" />
              <polygon id="navy-09" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="409.0,762.0 424.0,766.0 421.5,778.0 406.5,774.0" />
              <polygon id="navy-10" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="749.0,763.5 751.5,775.5 735.5,779.5 733.5,767.5" />
              <polygon id="navy-11" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="428.0,768.0 443.5,771.0 443.0,778.5 441.0,782.5 425.5,779.0" />
              <polygon id="navy-12" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="729.0,769.0 731.0,780.5 716.0,784.0 714.0,779.0 713.5,772.0" />
              <polygon id="navy-13" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="447.0,772.0 463.0,775.0 462.0,787.0 445.0,784.0" />
              <polygon id="navy-14" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="710.0,773.0 712.0,785.0 695.5,788.0 694.0,783.0 694.5,776.0" />
              <polygon id="navy-15" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="368.0,775.5 373.5,776.0 394.0,783.5 382.0,820.5 375.0,818.0 356.0,807.0 357.0,801.0" />
              <polygon id="navy-16" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="467.5,776.5 484.0,779.0 482.5,791.0 466.0,788.0" />
              <polygon id="navy-17" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="794.0,775.5 801.0,791.5 806.0,807.5 787.5,818.0 780.0,820.5 768.0,784.0 786.5,777.0" />
              <polygon id="navy-18" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="689.5,777.0 691.0,789.0 674.5,791.0 673.5,779.5" />
              <polygon id="navy-19" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="488.0,779.5 504.0,781.5 503.5,793.0 487.0,792.0" />
              <polygon id="navy-20" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="670.0,781.0 671.0,792.0 654.5,794.0 653.5,782.5 664.5,780.5" />
              <polygon id="navy-21" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="508.0,782.5 525.0,784.0 524.0,796.0 507.5,794.5" />
              <polygon id="navy-22" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="649.0,783.0 650.0,795.0 633.0,796.0 632.5,784.0" />
              <polygon id="navy-23" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="528.5,785.0 545.0,785.5 545.0,798.0 528.0,797.0" />
              <polygon id="navy-24" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="629.0,785.0 629.0,797.0 612.0,797.5 612.0,786.0" />
              <polygon id="navy-25" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="566.5,787.0 566.0,798.5 554.5,799.0 548.5,797.5 549.5,786.0" />
              <polygon id="navy-26" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="608.0,786.0 608.5,798.0 591.0,799.0 591.0,787.0" />
              <polygon id="navy-27" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="402.5,786.5 428.5,793.0 428.0,799.5 418.0,837.0 408.0,834.0 390.0,825.0 396.0,803.5" />
              <polygon id="navy-28" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="587.0,787.0 586.5,799.0 570.0,799.0 570.0,787.0" />
              <polygon id="navy-29" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="759.5,787.0 772.0,825.0 754.0,834.0 744.0,837.0 736.5,811.5 733.0,793.5 751.5,788.0" />
              <polygon id="navy-30" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="438.0,795.5 464.5,801.0 456.0,851.0 426.5,841.0 431.0,818.5" />
              <polygon id="navy-31" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="724.0,796.0 735.5,840.0 717.5,848.0 705.5,851.0 697.0,801.0" />
              <polygon id="navy-32" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="473.5,802.5 498.5,806.0 500.0,807.5 493.5,860.5 475.0,857.0 464.5,853.5" />
              <polygon id="navy-33" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="688.0,803.0 697.0,853.5 668.5,860.5 662.0,807.0 668.5,805.0" />
              <polygon id="navy-34" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="509.0,807.5 530.0,809.0 535.5,811.0 532.0,867.0 520.5,866.0 502.0,862.0 507.0,816.0" />
              <polygon id="navy-35" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="652.5,807.5 655.0,818.5 659.5,862.5 636.5,867.0 630.0,867.0 626.0,810.0" />
              <polygon id="navy-36" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="544.0,811.0 576.0,811.5 576.0,870.5 541.0,868.0" />
              <polygon id="navy-37" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="617.0,810.5 621.0,868.0 607.0,870.0 585.0,870.5 584.0,868.0 584.5,812.0" />
              <polygon id="navy-38" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="269.0,727.0 273.0,728.0 293.0,740.5 286.5,757.0 276.5,750.5 262.5,737.0" />
              <polygon id="navy-39" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="894.0,727.0 899.0,734.5 899.5,737.5 884.5,752.0 876.0,757.5 869.0,743.5 869.0,741.0 891.0,727.5" />
              <polygon id="navy-40" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="300.5,745.5 326.5,757.5 326.5,760.5 317.5,781.0 308.0,775.5 293.5,764.0" />
              <polygon id="navy-41" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="861.5,746.5 868.0,760.5 868.5,764.5 849.0,780.0 845.0,781.0 836.0,762.0 835.5,758.0 858.5,746.5" />
              <polygon id="navy-42" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="827.5,762.5 838.0,785.5 838.0,788.0 814.0,802.5 802.5,772.0" />
              <polygon id="navy-43" className="navy blk" data-zone="Planta Alta y Suites" fill="#2e3a7e" points="825.5,747.0 812.5,752.0 808.0,741.5 821.5,736.0" />
            </g>

            {/* Marcas (no vendibles, sin interacción) */}
            <g id="marcas" className="no-vendible">
              <polygon id="marca-01" fill="#ffffff" points="567.5,590.0 567.5,594.5" />
              <polygon id="marca-02" fill="#ffffff" points="586.5,582.5 584.0,588.0 580.5,591.5 585.5,587.0 586.5,585.0" />
              <polygon id="marca-03" fill="#ffffff" points="586.5,580.0 584.0,578.0 582.5,578.0 581.0,577.0 578.5,577.5 576.5,576.0 575.5,578.0 573.0,578.5 571.5,580.0 571.0,582.0 571.5,586.0 572.5,586.5 571.5,585.0 571.5,581.0 574.5,578.5 577.0,578.5 579.0,580.0 580.5,580.0 581.5,578.5 584.0,578.5 586.5,581.0" />
              <polygon id="marca-04" fill="#ffffff" points="567.5,572.0 557.5,571.5 557.0,574.5 557.5,575.0 557.5,584.5 558.0,572.5 559.0,571.5 565.5,571.5 567.5,573.0 567.5,575.5" />
              <polygon id="marca-05" fill="#ffffff" points="591.5,571.0 590.5,572.0 591.0,577.0 590.5,573.5 592.0,571.5 599.0,571.5 600.5,572.5 600.5,596.5 599.5,597.5 592.0,597.5 591.0,596.5 591.0,587.5 590.5,587.0 590.5,594.0 591.0,594.5 590.5,597.0 600.0,598.0 601.0,590.0 600.5,572.0" />
              <polygon id="marca-06" fill="#ffffff" points="594.5,563.0 589.0,568.0 590.5,567.5" />
              <polygon id="marca-07" fill="#ffffff" points="561.0,560.5 568.5,568.5 567.5,566.5" />
              <polygon id="marca-08" fill="#ffffff" points="617.5,540.0 610.0,547.5" />
              <polygon id="marca-09" fill="#ffffff" points="632.0,525.5 628.0,529.5" />
              <polygon id="marca-10" fill="#ffffff" points="654.0,503.5 648.0,509.5" />
              <polygon id="marca-11" fill="#ffffff" points="489.5,489.5 493.0,492.5" />
              <polygon id="marca-12" fill="#ffffff" points="484.0,483.0 484.0,484.0 486.5,486.0" />
              <polygon id="marca-13" fill="#ffffff" points="475.0,471.0 478.5,474.5" />
              <polygon id="marca-14" fill="#ffffff" points="742.0,415.5 741.0,415.5 738.0,418.0 734.0,423.0 737.0,421.5 741.5,417.0" />
              <polygon id="marca-15" fill="#ffffff" points="416.0,415.5 416.0,416.5 420.0,420.5 422.5,422.0 424.0,424.0 425.0,424.0 417.0,415.5" />
              <polygon id="marca-16" fill="#ffffff" points="577.0,374.0 578.5,376.5 580.5,375.5 580.5,375.0 578.5,375.0" />
              <polygon id="marca-17" fill="#ffffff" points="579.5,365.5 586.0,372.0 579.5,378.5 573.0,372.0" />
              <polygon id="marca-18" fill="#ffffff" points="474.0,468.5 480.5,475.0 474.0,481.5 467.5,475.0" />
              <polygon id="marca-19" fill="#ffffff" points="684.0,468.5 690.5,475.0 684.0,481.5 677.5,475.0" />
            </g>

            {/* Capa de Numeración de Bloques con alto contraste para Estadio Charros */}
            <g id="numeracion-bloques" pointerEvents="none" className="select-none font-sports">
              {CHARROS_BLOCK_LABELS.map((item) => {
                const pairs = item.pts.trim().split(/\s+/).map((p) => {
                  const [x, y] = p.split(',').map(Number);
                  return { x, y };
                });
                const sum = pairs.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }), { x: 0, y: 0 });
                const cx = sum.x / pairs.length;
                const cy = sum.y / pairs.length;

                const isShort = item.label.length <= 2;
                const fontSize = item.id.startsWith('navy')
                  ? '8.5'
                  : isShort
                    ? '11'
                    : item.label.length === 3
                      ? '9.5'
                      : '8.5';

                return (
                  <text
                    key={`charros-label-${item.id}`}
                    x={cx}
                    y={cy + 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize={fontSize}
                    fontWeight="900"
                    style={{
                      paintOrder: 'stroke fill',
                      stroke: '#0f172a',
                      strokeWidth: '2.4px',
                      strokeLinejoin: 'round',
                      userSelect: 'none',
                    }}
                  >
                    {item.label}
                  </text>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Guía Desplegable de Zonas y Precios */}
      {showZoneGuide && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 shadow-2xl">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 font-sports">
              Distribución de Zonas y Precios — Estadio Charros de Jalisco
            </h4>
            <span className="text-[10px] text-slate-500">9 zonas oficiales</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Object.values(CHARROS_ZONES).map((z) => {
              const price = getZonePrice(z.name, event);
              return (
                <div
                  key={z.name}
                  onClick={() => {
                    const sampleSec = sections.find((s) => s.zoneName.toLowerCase() === z.name.toLowerCase());
                    if (sampleSec) onSelectSection(sampleSec.sectionNumber, z.name);
                  }}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    activeZoneMeta?.name === z.name
                      ? 'bg-slate-800 border-amber-500/80 shadow-md ring-1 ring-amber-500/40'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-md shrink-0 border border-white/20 shadow-xs"
                      style={{ backgroundColor: z.colorHex }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{z.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{z.gate || 'Acceso General'}</div>
                    </div>
                  </div>
                  <span className="text-xs font-black text-amber-400 shrink-0 font-sports">
                    ${price}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
