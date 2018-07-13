合并冲突解决工具文件处理流程：

1. 传入 BASE，LOCAL，REMOTE 三个 fire 文件内容。
2. 针对 fire 文件内的数据，每个类型的数据会生成对应的唯一标识，同时针对数据的结构进行调整。
3. 生成调整过结构的 json 文件（BASE，LOCAL，REMOTE），调用第三方工具解决冲突。
（调用第三方工具之前需要在 package.json 中新增一个设置如图：
![image](https://user-images.githubusercontent.com/35832931/42624536-295fb298-85f8-11e8-83ee-93530072e2b7.png)
添加你电脑中你常用的第三方冲突解决工具。）
4. 解决冲突之后会保存一份 merge.json 文件到当前的文件目录下，同时还会有 MergeCache 的文件夹存储三个 json 文件。
5. 工具最后会对 merge.json 文件进行重新排序处理。
6. 生成新的 fire 文件，覆盖当前冲突文件。文件数据节点顺序以及组件顺序按照当前场景的节点树顺序重新排布。

生成的 json 文件数据结构：

![image](https://user-images.githubusercontent.com/35832931/42622308-acd2a76c-85f2-11e8-95d2-c0a3624f131d.png)
当前生成 json 文件的对比格式是如上图。

mark：是一个由代码生成的数据唯一标识。合并工具会根据这个唯一标识对数据内容的索引进行位置确认。生成标识的结构针对不同的数据类型会有细微的变化。
content：为 fire 文件内的原数据内容，但是为了更好的合并 cc.Node 类型去除了 components, prefab 两个数据的索引信息。 
_prefabInfos：当前节点的 prefab 信息。
_components：是当前节点的绑定组件内容 。![image](https://user-images.githubusercontent.com/35832931/42624013-f10aa5c0-85f6-11e8-9801-65ebb55270ff.png)
上图为 components 的存储数据结构，Components  去除了 node 关于 cc.Node 的索引信息， prefabInfo 则去除了 root 关于 cc.Node 的索引信息。
_clickEvent：是根据特殊的组件如： cc.Button 绑定的 clickEvent 记录，通过 components 的 clickEvent [] 获取相关记录之后关联到当前绑定组件的节点上。

![image](https://user-images.githubusercontent.com/35832931/42624129-3b57ff24-85f7-11e8-926d-3747c3d0e55a.png)
clickEvent 数据内容如上图。

target： 为绑定节点索引信息。
component：为绑定节点上相应组件。
handler：组件内自定义的函数内容。
customEventData：自定义收发事件信息。

根据 fire 文件获取的 content 数据内容不足以支持 Components 在文件数据排序之后仍然获取正确的 clickEvent，因此在这里通过一个 clickEvent 数组对这种数据进行了关联记录。

可能存在无法解决的问题：

比较特殊的冲突问题是针对 _id 数据的比较，目前没有特别好的办法调整。举例而言，当一个版本场景下增添了一个节点数据，在另一个版本下并没有通过合并的方式修改场景，而是通过手动增添一个同样的节点数据在场景中，这会导致相同的节点数据信息但是拥有不同的 _id 数据，因为新生成的节点都会有相应的唯一 _id 生成。
冲突对比过程中，以上结构尽量减少了 __id__ 的存在。

经过实验测试了两个场景：
1.9.3 的 webp-test。
2.0 的 TestList (调整过，场景内添加了所有的功能组件)。
最后结果是：场景稳定打开，绑定内容都在。