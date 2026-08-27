-- Update Kandhi Layout plot dimensions
-- Run after migration 20260827100000_add_plot_dimensions.sql

DO $$
DECLARE proj_id uuid;
BEGIN
  SELECT id INTO proj_id FROM public.projects WHERE slug = 'kandhi-layout' LIMIT 1;
  IF proj_id IS NULL THEN RAISE NOTICE 'Project kandhi-layout not found'; RETURN; END IF;

  UPDATE public.plots SET
    length_m = 19.9, width_m = 14.9,
    area_sq_yards = 356.5, area_sq_ft = 3191.63,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '1';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.99,
    area_sq_yards = 207.3, area_sq_ft = 2163.67,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '2';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.99,
    area_sq_yards = 214.71, area_sq_ft = 2163.67,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '3';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.99,
    area_sq_yards = 222.11, area_sq_ft = 2163.67,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '4';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.99,
    area_sq_yards = 236.89, area_sq_ft = 2163.67,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '5';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.98,
    area_sq_yards = 236.89, area_sq_ft = 2161.63,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '6';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '7';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '8';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '9';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 12.19,
    area_sq_yards = 266.66, area_sq_ft = 2399.94,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '10';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 222.22, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '11';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '12';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '13';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '14';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '15';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '16';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '17';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '18';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '19';
  UPDATE public.plots SET
    length_m = 21.8, width_m = 14.49,
    area_sq_yards = 361.93, area_sq_ft = 3400.13,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '20';
  UPDATE public.plots SET
    length_m = 21.8, width_m = 10.97,
    area_sq_yards = 287.35, area_sq_ft = 2574.21,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '21';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 183.88, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '22';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 217.69, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '23';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 228.95, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '24';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 228.95, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '25';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 228.95, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '26';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 228.95, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '27';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 228.95, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '28';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 254.37, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '29';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 12.19,
    area_sq_yards = 266.56, area_sq_ft = 2399.94,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '30';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '31';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '32';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '33';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '34';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '35';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '36';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '37';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '38';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '39';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 10.97,
    area_sq_yards = 240.0, area_sq_ft = 2159.69,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '40';
  UPDATE public.plots SET
    length_m = 18.29, width_m = 17.98,
    area_sq_yards = 358.89, area_sq_ft = 3539.74,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '41';
  UPDATE public.plots SET
    length_m = 22.87, width_m = 10.97,
    area_sq_yards = 299.08, area_sq_ft = 2700.47,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '42';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '43';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '44';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '45';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '46';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '47';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '48';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '49';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '50';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '51';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '52';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 222.13, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '53';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 254.3, area_sq_ft = 2519.85,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '54';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.85, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '55';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.9, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '56';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.9, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '57';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.9, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '58';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.82, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '59';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.9, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '60';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.9, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '61';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.9, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '62';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.9, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '63';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 228.95, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '64';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 12.7,
    area_sq_yards = 342.45, area_sq_ft = 2917.26,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '65';
  UPDATE public.plots SET
    length_m = 19.19, width_m = 12.19,
    area_sq_yards = 295.8, area_sq_ft = 2518.02,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '66';
  UPDATE public.plots SET
    length_m = 19.21, width_m = 12.19,
    area_sq_yards = 280.16, area_sq_ft = 2520.61,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '67';
  UPDATE public.plots SET
    length_m = 19.21, width_m = 10.97,
    area_sq_yards = 252.3, area_sq_ft = 2268.3,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '68';
  UPDATE public.plots SET
    length_m = 23.73, width_m = 10.97,
    area_sq_yards = 311.39, area_sq_ft = 2802.08,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '69';
  UPDATE public.plots SET
    length_m = 23.73, width_m = 12.19,
    area_sq_yards = 346.0, area_sq_ft = 3113.7,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '71';
  UPDATE public.plots SET
    length_m = 23.73, width_m = 12.19,
    area_sq_yards = 346.0, area_sq_ft = 3113.7,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '72';
  UPDATE public.plots SET
    length_m = 23.73, width_m = 12.19,
    area_sq_yards = 346.0, area_sq_ft = 3113.7,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '73';
  UPDATE public.plots SET
    length_m = 23.73, width_m = 12.19,
    area_sq_yards = 346.0, area_sq_ft = 3113.7,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '74';
  UPDATE public.plots SET
    length_m = 23.73, width_m = 21.09,
    area_sq_yards = 571.85, area_sq_ft = 5387.06,
    details = 'Corner/large plot'
  WHERE project_id = proj_id AND plot_number = '75';
  UPDATE public.plots SET
    length_m = 24.03, width_m = 12.19,
    area_sq_yards = 331.95, area_sq_ft = 3153.1,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '76';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 12.7,
    area_sq_yards = 326.18, area_sq_ft = 2917.26,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '77';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '78';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 12.7,
    area_sq_yards = 342.45, area_sq_ft = 2917.26,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '79';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '80';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '81';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '82';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '83';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '84';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '85';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '86';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 12.19,
    area_sq_yards = 311.11, area_sq_ft = 2800.04,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '87';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 12.19,
    area_sq_yards = 311.11, area_sq_ft = 2800.04,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '88';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '89';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '90';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '91';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '92';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '93';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2519.85,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '94';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 16.76,
    area_sq_yards = 408.96, area_sq_ft = 3849.85,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '95';
  UPDATE public.plots SET
    length_m = 21.34, width_m = 13.03,
    area_sq_yards = 336.15, area_sq_ft = 2993.04,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '96';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '97';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '98';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '99';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '100';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '101';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '102';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '103';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '104';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '105';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '106';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '107';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 222.22, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '108';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 15.24,
    area_sq_yards = 297.77, area_sq_ft = 2691.97,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '109';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '110';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '111';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '112';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '113';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '114';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '115';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '116';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '117';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 10.97,
    area_sq_yards = 268.0, area_sq_ft = 1937.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '118';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 12.19,
    area_sq_yards = 268.0, area_sq_ft = 2153.23,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '119';
  UPDATE public.plots SET
    length_m = 16.41, width_m = 17.45,
    area_sq_yards = 440.7, area_sq_ft = 3082.27,
    details = 'Corner/large plot'
  WHERE project_id = proj_id AND plot_number = '120';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 13.03,
    area_sq_yards = 279.34, area_sq_ft = 2447.41,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '121';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '122';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '123';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '124';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 12.7,
    area_sq_yards = 324.15, area_sq_ft = 2385.41,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '125';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 12.19,
    area_sq_yards = 311.11, area_sq_ft = 2289.72,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '126';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '127';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '128';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '129';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '130';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '131';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '132';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '133';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '134';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 15.0,
    area_sq_yards = 416.1, area_sq_ft = 2817.48,
    details = 'Corner/large plot'
  WHERE project_id = proj_id AND plot_number = '135';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 12.19,
    area_sq_yards = 311.11, area_sq_ft = 2289.72,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '136';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '137';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '138';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '139';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '140';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '141';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 280.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '142';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 12.7,
    area_sq_yards = 327.49, area_sq_ft = 2385.41,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '143';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 257.31, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '144';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '145';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '146';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '147';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '148';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '149';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '150';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 12.19,
    area_sq_yards = 244.44, area_sq_ft = 2289.72,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '151';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 13.03,
    area_sq_yards = 326.94, area_sq_ft = 2447.41,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '152';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '153';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '154';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '155';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '156';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '157';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '158';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '159';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '160';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 12.19,
    area_sq_yards = 244.44, area_sq_ft = 2289.72,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '161';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 12.7,
    area_sq_yards = 254.7, area_sq_ft = 2385.41,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '162';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '163';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '164';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 10.97,
    area_sq_yards = 220.0, area_sq_ft = 2060.55,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '165';
  UPDATE public.plots SET
    length_m = 17.45, width_m = 16.76,
    area_sq_yards = 367.35, area_sq_ft = 3148.04,
    details = 'Corner/large plot'
  WHERE project_id = proj_id AND plot_number = '166';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '167';
  UPDATE public.plots SET
    length_m = 16.76, width_m = 12.7,
    area_sq_yards = 312.0, area_sq_ft = 2291.12,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '168';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '169';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '170';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '171';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 231.53, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '172';
  UPDATE public.plots SET
    length_m = 16.76, width_m = 10.97,
    area_sq_yards = 222.22, area_sq_ft = 1979.07,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '173';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '174';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '175';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '176';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '177';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '178';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '179';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '180';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '181';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '182';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 297.22, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '183';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '184';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 222.22, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '185';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '186';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '187';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '188';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '189';
  UPDATE public.plots SET
    length_m = 16.76, width_m = 14.9,
    area_sq_yards = 354.55, area_sq_ft = 2687.99,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '190';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '191';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '192';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 222.22, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '193';
  UPDATE public.plots SET
    length_m = 16.76, width_m = 12.7,
    area_sq_yards = 297.22, area_sq_ft = 2291.12,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '194';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '195';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '196';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '197';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '198';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '199';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '200';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '201';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '202';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '203';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '204';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 222.22, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '205';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 231.53, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '206';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '207';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '208';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.77,
    area_sq_yards = 197.1, area_sq_ft = 1766.7,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '209';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 9.7,
    area_sq_yards = 162.6, area_sq_ft = 1591.24,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '210';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 10.97,
    area_sq_yards = 237.5, area_sq_ft = 2440.74,
    details = 'Corner plot'
  WHERE project_id = proj_id AND plot_number = '211';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 12.19,
    area_sq_yards = 316.6, area_sq_ft = 2712.21,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '212';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 10.97,
    area_sq_yards = 271.3, area_sq_ft = 2440.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '213';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 10.97,
    area_sq_yards = 271.3, area_sq_ft = 2440.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '214';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 10.97,
    area_sq_yards = 271.3, area_sq_ft = 2440.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '215';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 10.97,
    area_sq_yards = 271.3, area_sq_ft = 2440.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '216';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 10.97,
    area_sq_yards = 271.3, area_sq_ft = 2440.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '217';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 10.97,
    area_sq_yards = 271.3, area_sq_ft = 2440.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '218';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 10.97,
    area_sq_yards = 271.3, area_sq_ft = 2440.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '219';
  UPDATE public.plots SET
    length_m = 20.67, width_m = 14.9,
    area_sq_yards = 394.53, area_sq_ft = 3315.1,
    details = 'Corner/large plot'
  WHERE project_id = proj_id AND plot_number = '220';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '221';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '222';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '223';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '224';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '225';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '226';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '227';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '228';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '229';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '230';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '231';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '232';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 12.19,
    area_sq_yards = 233.4, area_sq_ft = 1999.74,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '233';
  UPDATE public.plots SET
    length_m = 15.24, width_m = 10.97,
    area_sq_yards = 200.0, area_sq_ft = 1799.53,
    details = NULL
  WHERE project_id = proj_id AND plot_number = '234';

  RAISE NOTICE 'Kandhi Layout dimensions updated';
END $$;