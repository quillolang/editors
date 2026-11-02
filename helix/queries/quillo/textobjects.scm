; Written for Helix (not made by tree-sitter/scripts/queries.js): mif, maf, mac, mia...
(function_definition
  body: (_) @function.inside) @function.around

(lambda
  body: (_) @function.inside) @function.around

(component_definition
  body: (_) @class.inside) @class.around

(route
  body: (_) @function.inside) @function.around

(parameters
  ((parameter) @parameter.inside . ","? @parameter.around) @parameter.around)

(arguments
  ((_) @parameter.inside . ","? @parameter.around) @parameter.around)

(comment) @comment.inside

(comment)+ @comment.around

(element) @xml-element.around
